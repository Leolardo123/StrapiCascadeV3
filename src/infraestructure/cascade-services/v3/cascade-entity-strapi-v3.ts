import { secretEntities } from "../v2/load-strapi-entity-schemas";
import { CascadeStrapiV3Upsert } from "./interface/cascade-entity-strapi-v3.interface";
import { formatFieldStrapi } from "../utils/format-fields-strapi";

import { v4 } from "uuid";
import { camelToSnakeCase, snakeToCamelCase } from "../utils/string-case-conversion";
import _ from 'lodash'
import { strapiContentType, strapiDeepEntity, strapiSchema } from "../../../../types/generated/custom";
const contextError = {
  context: "(Cascade Entity Strapi V3)",
};

const handleGetLinkTableName = <T extends strapiContentType>(schema: strapiSchema<T>, attribute) => {
  if (schema?.attributes?.[attribute]?.type != "relation") return;

  const reverseSchema = strapi.getModel(schema.attributes[attribute].target);
  const mappedBy = schema.attributes[attribute].mappedBy;
  const mappedName = !mappedBy ? schema.info.pluralName : reverseSchema.info.pluralName; // ReversedBy is aways plural? (!mappedBy = reversedBy)
  const reversedNameType = !mappedBy ? "ToMany" : "manyTo";
  const reversedSchema = !mappedBy ? reverseSchema : schema;

  const thisName = [
    mappedName,
  ];

  if (schema.attributes[attribute].relation.includes(reversedNameType)) {
    thisName.push(reversedSchema.info.pluralName);
  } else {
    thisName.push(reversedSchema.info.singularName);
  }

  return{
    linkTable: thisName.join("_")
    .concat("_lnk"), // Strapi V5
  // .concat("_link"), // Strapi V4
    reverse: reverseSchema.info.singularName
  }
};

const recursiveKnexTransaction = async <T extends strapiContentType>({
  trx,
  data,
  target,
  options,
}: CascadeStrapiV3Upsert<T>) => {
  const schema: any = strapi.getModel(target as any);

  if (!schema) {
    throw new Error("Schema not found " + contextError);
  }

  let targetData = {} as any;
  const relationalData = {};
  const linkData = {} as { table: string; data: any }[];
  Object.keys(data).forEach(async (attribute) => {
    const linkTableName = handleGetLinkTableName(schema, attribute);
    const type = schema.attributes[attribute]?.type;
    const attrSchema: any = schema.attributes[attribute];
    const columnName = camelToSnakeCase(attribute); // Needed for postgres

    if (
      data[attribute] === undefined ||
      (options?.ignore_null && data[attribute] === null) ||
      // Ignore attributes that are not found in the schema
      (options?.ignore_not_found &&
        attribute !== "id" && // id is ommited in the schema, so it will always be ignored
        !attrSchema)
    ) {
      delete targetData[attribute];
      return;
    }

    if (typeof data[attribute] === "string" && options?.normalize_strings) {
      data[attribute] = data[attribute]
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    }

    if (["id"].includes(attribute) || secretEntities.includes(target)) return;

    if (type !== "relation") {
      // formatFieldStrapi
      const parsedValue = formatFieldStrapi(attribute, data[attribute], type, {
        context: "getOperations",
      });

      targetData[columnName] = parsedValue;

      return;
    }

    if (!attrSchema) {
      throw new Error(
        `Attribute ${attribute} not found in ${target} ${contextError.context}`
      );
    }

    if (type === "relation" && data[attribute]) {
      if (/ToMany/g.test(attrSchema.relation)) {
        if (!Array.isArray(data[attribute])) {
          throw new Error(
            `${attribute} in ${target} must be array ${contextError.context}`
          );
        }

        const promise = data[attribute].map(async (item) => {
          if (typeof item === "number") return;

          const linkTableName = handleGetLinkTableName(schema, attribute);
          const result = await recursiveKnexTransaction({
            trx,
            data: item,
            target: attrSchema.target,
            options,
          });

          if (linkData[attribute]) {
            linkData[attribute].push({
              table: linkTableName.linkTable,
              data: {
                [`${linkTableName.reverse}_id`]: result.id,
              }
            });
          } else {
            linkData[attribute] = [
              {
                table: linkTableName.linkTable,
                data: {
                  [`${linkTableName.reverse}_id`]: result.id,
                }
              }
            ];
          }

          return result;
        });

        relationalData[attribute] = await Promise.all(promise);
      } else {
        if (Array.isArray(data[attribute])) {
          throw new Error(
            `${attribute} in ${target} can't be array ${contextError.context}`
          );
        }

        if (typeof data[attribute] === "number") return;

        const linkTableName = handleGetLinkTableName(schema, attribute);

        const result = await recursiveKnexTransaction({
          trx,
          data: data[attribute],
          target: attrSchema.target,
          options,
        });

        linkData[attribute] = [{
          table: linkTableName.linkTable,
          data: {
            [`${linkTableName.reverse}_id`]: result.id,
          }
        }]; // Aways will be an array to simplify the code

        relationalData[attribute] = result;
      }
    }
  });

  if (!targetData.document_id) {
    targetData.document_id = v4();
  }

  const id = await trx.insert(targetData, "id").into(schema.collectionName);

  targetData.id = id[0].id;

  if (Object.keys(linkData).length > 0) {
    Object.keys(linkData).forEach(async (attribute) => {
      linkData[attribute].forEach(async (item) => {
        await trx.insert({
          ...item.data,
          [`${schema.info.singularName}_id`]: id[0].id
        }, "id").into(item.table);
      })
    })
  }

  return {
    ..._.mapKeys(targetData, (v, k) => _.camelCase(k)) as any,
    ...relationalData
  };
};

const StrapiCascadeV3 = {
  cascadeUpsert: async <T extends strapiContentType>({
    data,
    target,
  }: {
    data: strapiDeepEntity<T>;
    target: T;
  }) => {
    const strapiKnex = strapi.db.connection;

    return await strapiKnex.transaction(async (trx) => {
      return recursiveKnexTransaction({
        trx,
        data,
        target,
      });
    });
  },

  cascadeDelete: <T extends string>({
    id,
    target,
    relations = [],
  }: {
    id: number | string;
    target: T;
    relations?: string[];
  }) => {
    throw new Error("Method not implemented.");
  },
};

export { StrapiCascadeV3 };
