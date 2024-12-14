import { globalSchema } from "../v2/load-strapi-entity-schemas";
import { secretEntities } from "../v2/load-strapi-entity-schemas";
import { CascadeStrapiV3Upsert } from "./interface/cascade-entity-strapi-v3.interface";
import { formatFieldStrapi } from "../../utils/format-fields-strapi";
import { strapiEntity } from "../../../../../types/generated/custom";

const contextError = {
  context: "(Cascade Entity Strapi V3)",
};

const recursiveKnexTransaction = async <T extends string>(
  {
    trx,
    data,
    target,
    options,
  }: CascadeStrapiV3Upsert<T>
) => {
  if (!globalSchema[target] && !secretEntities.includes(target)) {
    throw new Error(
      `Entity ${target} Schema not found ${contextError.context}`
    );
  }

  const targetData = data;
  Object.keys(data).forEach((attribute) => {
    if (!globalSchema[target]) return;

    const type = globalSchema[target].attributes[attribute]?.type;
    const attrSchema = globalSchema[target].attributes[attribute];

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

      targetData[attribute] = parsedValue;

      return;
    }

    if (!attrSchema) {
      throw new Error(
        `Attribute ${attribute} not found in ${target} ${contextError.context}`
      );
    }

    const relation = attrSchema.target;

    if (type === "relation" && !relation) {
      throw new Error(
        `Relation ${attribute} not loaded properly in ${target} ${contextError.context}`
      );
    }

    if (type === "relation" && data[attribute]) {
      if (typeof data[attribute] === "number") {
          // If attribute is ID for linking entities, should just ignore
        return;
      }
      if (/ToMany/g.test(attrSchema.relation)) {
        if (!Array.isArray(data[attribute])) {
          throw new Error(
            `${attribute} in ${target} must be array ${contextError.context}`
          );
        }

        if (typeof data[attribute][0] === "number") {
          // If attribute is ID for linking entities, should just ignore
          return;
      } else {
          targetData[attribute] = data[attribute].map((item) => {
            return recursiveKnexTransaction({
              trx,
              data: item,
              target: relation,
              options
            })
          });
        }
      }
    }
  });

  if (!targetData.id) {
    return trx(target).insert(targetData);
  } else {
    return trx(target).update(targetData);
  }
}

const StrapiCascadeV3 = {
  cascadeUpsert: async <T extends string>({
    data,
    target,
  }: {
    data: strapiEntity<T>;
    target: T;
  }) => {
    const strapiKnex = strapi.db.connection;

    const result = await strapiKnex.transaction(async (trx) => {
      return recursiveKnexTransaction({
        trx,
        data,
        target,
      });
    });

    return result;
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

  },
}

export { StrapiCascadeV3 }
