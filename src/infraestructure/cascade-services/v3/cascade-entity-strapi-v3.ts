import { secretEntities } from "../v2/load-strapi-entity-schemas";
import { CascadeStrapiV3Upsert } from "./interface/cascade-entity-strapi-v3.interface";
import { formatFieldStrapi } from "../utils/format-fields-strapi";
import { strapiContentType, strapiDeepEntity, strapiEntity, strapiSchema } from "../../../../types/generated/custom";
import _ from 'lodash'
import utils from "@strapi/utils";
const { ApplicationError } = utils.errors;

const contextError = {
  context: "(Cascade Entity Strapi V3)",
};

const strapiCall = {
  'create': <T extends strapiContentType>(target: T, data: strapiEntity<T>) => {
    const strapiAny = strapi as any;
    if (process.env.STRAPI_VER === "4") {
      // V4
      return strapi.entityService.create(target as any, { data });
    } else {
      // V5
      return strapiAny.documents("api::article.article").create({
        data,
        status: 'published',
      });
    }
  },
  'update': <T extends strapiContentType>(target: T, id: number | string, data: strapiEntity<T>) => {
    const strapiAny = strapi as any; // Because V4 does not have strapi.documents
    if (process.env.STRAPI_VER === "4") {
      // V4
      return strapi.entityService.update(target as any, id, { data });
    } else {
      // V5
      return strapiAny.documents(target).update({
        documentId: id,
        data,
        status: 'published',
      });
    }
  },
}

const getId = (field: any) => {
  const strapiAny = strapi as any;
  if (typeof field !== "object") {
    if (strapiAny?.documents) {
      return { documentId: field };
    } else {
      return { id: field };
    }
  }


}

const getIdFromEntity = (field: any) => {
  const strapiAny = strapi as any;
  if (typeof field === "object") {
    if (strapiAny?.documents) {
      return field.documentId;
    } else {
      return field.id;
    }
  }
}

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
    // .concat("_lnk"), // Strapi V5
    .concat("_links"), // Strapi V4
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
  Object.keys(data).forEach(async (attribute) => {
    const type = schema.attributes[attribute]?.type;
    const attrSchema: any = schema.attributes[attribute];
    let dataAttribute = data[attribute];

    if (
      dataAttribute === undefined ||
      (options?.ignore_null && dataAttribute === null) ||
      // Ignore attributes that are not found in the schema
      (options?.ignore_not_found &&
        attribute !== "id" && // id is ommited in the schema, so it will always be ignored
        !attrSchema)
    ) {
      delete targetData[attribute];
      return;
    }

    if (typeof dataAttribute === "string" && options?.normalize_strings) {
      dataAttribute = dataAttribute
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    }

    if (["id"].includes(attribute) || secretEntities.includes(target)) return;

    if (type !== "relation") {
      // formatFieldStrapi
      const parsedValue = formatFieldStrapi(attribute, data[attribute], type, {
        context: "getOperations",
      });

      targetData[attribute] = parsedValue;

      return;
    }

    if (!attrSchema) {
      throw new Error(
        `Attribute ${attribute} not found in ${target} ${contextError.context}`
      );
    }

    if (type === "relation" && dataAttribute) {
      if (/ToMany/g.test(attrSchema.relation)) {
        if (!Array.isArray(dataAttribute)) {
          throw new Error(
            `${attribute} in ${target} must be array ${contextError.context}`
          );
        }

        const promise = dataAttribute.map(async (item) => {
          if (typeof dataAttribute != "object") {
            targetData[attribute] = dataAttribute;
          } else if (item.documentId || item.id) {
            targetData[attribute] = getId(item.documentId || item.id);
          }

          const result = await recursiveKnexTransaction({
            trx,
            data: item,
            target: attrSchema.target,
            options,
          });

          return result;
        });

        relationalData[attribute] = await Promise.all(promise);
      } else {
        if (Array.isArray(dataAttribute)) {
          throw new Error(
            `${attribute} in ${target} can't be array ${contextError.context}`
          );
        }

        if (typeof dataAttribute != "object") {
          targetData[attribute] = dataAttribute;
        } else if (
          dataAttribute.documentId ||
          dataAttribute.id
        ) {
          targetData[attribute] = getId(dataAttribute.documentId || dataAttribute.id);
        }

        console.log('dataAttribute', dataAttribute);
        const result = await recursiveKnexTransaction({
          trx,
          data: dataAttribute,
          target: attrSchema.target,
          options,
        });
        console.log('result', result);

        relationalData[attribute] = result;
      }
    }
  });

  let response;
  const realId = getIdFromEntity(targetData);
  if (!realId) {
    response = await strapiCall.create(
      target,
      targetData
    );
  } else {
    response = await strapiCall.update(
      target,
      realId,
      targetData
    );
  }


  return {
    ...response,
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

    try {
      return await strapiKnex.transaction(async (trx) => {
        return recursiveKnexTransaction({
          trx,
          data,
          target,
        });
      });
    } catch (err) {
      throw new ApplicationError(
        err?.message + contextError?.context ||
        "Error executing cascade operation" + contextError?.context
      );
    }
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

  handleGetLinkTableName
};

export { StrapiCascadeV3 };
