import { secretEntities } from "../v2/load-strapi-entity-schemas";
import { CascadeStrapiV3Upsert } from "./interface/cascade-entity-strapi-v3.interface";
import { formatFieldStrapi } from "../../utils/format-fields-strapi";
import {
  strapiContentType,
} from "../../../../../types/generated/custom";
import { v4 } from "uuid";
import { camelToSnakeCase } from "../../utils/string-case-conversion";

const contextError = {
  context: "(Cascade Entity Strapi V3)",
};

const recursiveKnexTransaction = async <T extends strapiContentType>({
  trx,
  data,
  target,
  options,
}: CascadeStrapiV3Upsert<T>) => {
  const schema = strapi.getModel(target);

  if (!schema) {
    throw new Error("Schema not found " + contextError);
  }

  let targetData = {} as any;
  const relationalData = {};
  Object.keys(data).forEach(async (attribute) => {
    const type = schema.attributes[attribute]?.type;
    const attrSchema = schema.attributes[attribute];
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
          if (typeof item === "number") {
            // If attribute is ID for linking entities, should just ignore
            return;
          } 

          return recursiveKnexTransaction({
            trx,
            data: item,
            target: attrSchema.target,
            options,
          });
        });

        relationalData[attribute] = await Promise.all(promise);
      } else {
        if (typeof data[attribute] === "number") {
          // If attribute is ID for linking entities, should just ignore
          return;
        } 

        relationalData[attribute] = await recursiveKnexTransaction({
          trx,
          data: data[attribute],
          target: attrSchema.target,
          options,
        });
      }
    }
  });

  if (!targetData.document_id) {
    targetData.document_id = v4();
  }

  const id = await trx.insert(targetData, "id").into(schema.collectionName);

  targetData.id = id[0].id;

  return {
    ...targetData,
    ...relationalData
  } 
};

const StrapiCascadeV3 = {
  cascadeUpsert: async <T extends strapiContentType>({
    data,
    target,
  }: {
    data: any;
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
