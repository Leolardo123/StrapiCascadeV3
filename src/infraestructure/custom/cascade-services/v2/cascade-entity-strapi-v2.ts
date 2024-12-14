/* eslint-disable @typescript-eslint/no-explicit-any */
import { IStrapiRelational } from "../v3/interface/load-strapi-entity-schemas-v3";
import { formatFieldStrapi } from "../../utils/format-fields-strapi";
import {
  CascadeOperatorEnum,
  CascadeStrapiV2Error,
  ICascadeEntityStrapiV2,
  IGetCascadeTreeDTO,
  IOperation,
  IOperationDTO,
  IOperationResult,
  LinkTypeEnum,
} from "./interface/cascade-entity-strapi-v2.interface";
import { strapiContentType, strapiEntity, strapiFilters } from "../../../../../types/generated/custom";
import { errorParserStrapi } from "../../error/error-parser";
import { isDevMode } from "../../../../../config/custom";

const contextError = {
  context: "(Cascade Entity Strapi V2)",
};

const secretEntities = ["plugin::users-permissions.user"];

/**
 * @param {IGetCascadeTreeDTO} param0
 * @returns {string[]} - Array of relations to be cascaded
 *
 * @description
 * Gets the populate param for cascading operations
 */
const getCascadeTree = <T extends strapiContentType>({
  entity,
  previous,
}: IGetCascadeTreeDTO): string[] => {
  const strapiCustom = strapi as any;
  const { relationalSchema } = strapiCustom.schemas;

  const tree = [] as string[];

  if (!relationalSchema) {
    throw new Error(`Relational Schema not found ${contextError.context}`);
  }

  if (!relationalSchema[entity]) return [];

  const entityRelationalSchema = relationalSchema[entity] as IStrapiRelational;

  if (entityRelationalSchema.cascade?.delete) {
    entityRelationalSchema.cascade.delete.forEach((relation) => {
      tree.push(previous ? `${previous}.${relation}` : relation);

      if (!entityRelationalSchema.relations[relation]) return [];

      const cascadeTree = getCascadeTree<T>({
        entity: entityRelationalSchema.relations[relation].target,
        previous: previous ? `${previous}.${entity}` : relation,
      });

      if (cascadeTree) {
        tree.push(...cascadeTree);
      }

      return tree;
    });
  }

  return tree;
};

const getOperations = <T extends strapiContentType>({
  data,
  entitySchemas,
  entity,
  attribute: attributeRelation,
  operation,
  options,
  link_to,
  link_type,
}: IOperationDTO<T>): IOperation<T>[] => {
  if (!entitySchemas[entity] && !secretEntities.includes(entity)) {
    throw new Error(
      `Entity ${entity} Schema not found ${contextError.context}`
    );
  }

  const operations = [] as IOperation<T>[];
  const entityData = data;

  let createPublishedAt = CascadeOperatorEnum.DELETE !== operation;
  Object.keys(data).forEach((attribute) => {
    if (!entitySchemas[entity]) return;

    const type = entitySchemas[entity].attributes[attribute]?.type;
    const attrSchema = entitySchemas[entity].attributes[attribute];

    if (
      data[attribute] === undefined ||
      (options?.ignore_null && data[attribute] === null) ||
      // Ignore attributes that are not found in the schema
      (options?.ignore_not_found &&
        attribute !== "id" && // id is ommited in the schema, so it will always be ignored
        !attrSchema)
    ) {
      delete entityData[attribute];
      return;
    }

    if (!data?.id && operation === CascadeOperatorEnum.UPDATE) {
      operation = CascadeOperatorEnum.CREATE;
      createPublishedAt = true;
    }

    if (attribute === "id" && operation === CascadeOperatorEnum.CREATE) {
      operation = CascadeOperatorEnum.UPDATE;
      createPublishedAt = false;
    }

    if (typeof data[attribute] === "string" && options?.normalize_strings) {
      data[attribute] = data[attribute]
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    }

    if (["id"].includes(attribute) || secretEntities.includes(entity)) return;

    if (
      // On delete cascade only id and relations matter
      operation === CascadeOperatorEnum.DELETE &&
      (!entityData[attribute] || !attrSchema || type !== "relation")
    ) {
      delete entityData[attribute];
      return;
    }

    if (type !== "relation") {
      // formatFieldStrapi
      const parsedValue = formatFieldStrapi(attribute, data[attribute], type, {
        context: "getOperations",
      });

      entityData[attribute] = parsedValue;

      return;
    }

    if (!attrSchema) {
      throw new Error(
        `Attribute ${attribute} not found in ${entity} ${contextError.context}`
      );
    }

    const relation = attrSchema.target;

    if (type === "relation" && !relation) {
      throw new Error(
        `Relation ${attribute} not loaded properly in ${entity} ${contextError.context}`
      );
    }

    if (type === "relation" && data[attribute]) {
      if (typeof data[attribute] === "number") {
        // If is only a entity link, and not a cascade operation
        return;
      }
      if (/ToMany/g.test(attrSchema.relation)) {
        if (!Array.isArray(data[attribute])) {
          throw new Error(
            `${attribute} in ${entity} must be array ${contextError.context}`
          );
        }

        if (typeof data[attribute][0] === "number") {
          // If is only a entity link, and not a cascade operation
          return;
        }

        const arrArrManyToMany = data[attribute].map((item) =>
          getOperations<T>({
            data: item,
            entitySchemas,
            entity: relation as T,
            attribute,
            operation,
            link_to: (link_to || -1) + 1,
            link_type: LinkTypeEnum.TO_MANY,
            options,
          })
        );

        operations.push(...arrArrManyToMany.flat());
      } else {
        operations.push(
          ...getOperations<T>({
            data: data[attribute],
            entitySchemas,
            entity: relation as T,
            attribute,
            operation,
            link_to: (link_to || -1) + 1,
            link_type: LinkTypeEnum.TO_ONE,
            options,
          })
        );
      }

      if (
        entityData[attribute].id &&
        operation !== CascadeOperatorEnum.DELETE
      ) {
        entityData[attribute] = entityData[attribute].id;
      } else {
        delete entityData[attribute];
      }
    }
  });

  if (createPublishedAt) {
    Object.assign(entityData, {
      publishedAt: new Date(),
    });
  }

  operations.unshift({
    data: entityData,
    target: entity,
    operation,
    attribute: attributeRelation,
    link_to,
    link_type,
  });

  return operations;
};

const executeStrapiOperation = async <T extends strapiContentType>({
  data,
  target,
  operation,
}): Promise<strapiEntity<T>> => {
  try {
    if (operation === CascadeOperatorEnum.CREATE) {
      const res = await strapi.entityService.create(target, { data });
      return res as strapiEntity<T>;
    }

    if (operation === CascadeOperatorEnum.UPDATE) {
      const res = await strapi.entityService.update(target, data.id, {
        data,
      });
      return res as strapiEntity<T>;
    }

    if (operation === CascadeOperatorEnum.DELETE) {
      const res = await strapi.entityService.delete(target, data.id);
      return res as strapiEntity<T>;
    }

    throw new Error(`Operation ${operation} not found ${contextError.context}`);
  } catch (err) {
    console.log("errors", err, data);

    let message = err.message || "Error executing operation";
    if (err?.details?.errors) {
      const translated = errorParserStrapi(err.details.errors[0]);

      message = translated.message;
    }

    if (isDevMode) {
      message += ` - ([${operation}]|${target}) - ${contextError.context}`;
    }

    throw new Error(message);
  }
};

/**
 * @param {ICascadeEntityStrapiV2} param0
 * @returns {Promise<strapiFilters<T>>} - Data formatted as the original entity
 *
 * @description
 * Cascade operations for Strapi entities
 *
 * @description
 * Does not support:
 * - Admin and Plugin entities except for plugin::users-permissions.user
 * - Transactions
 */
const cascadeEntityStrapiV2 = async <T extends strapiContentType>({
  data,
  entity,
  operation: opType = CascadeOperatorEnum.CREATE,
  relations = [],
  options = { ignore_null: true },
}: ICascadeEntityStrapiV2<T, any>) => {
  const executedOperations = [] as IOperationResult<T>[];
  const failedOperations = [] as {
    message: string;
    operation: IOperationResult<T>;
  }[];
  let operations = [] as IOperation<T>[];

  try {
    if (
      [CascadeOperatorEnum.UPDATE, CascadeOperatorEnum.DELETE].includes(
        opType
      ) &&
      !data.id
    ) {
      throw new Error(
        `ID not informed for [${opType}] ${entity} ${contextError.context}`
      );
    }

    const strapiCustom = strapi as any;
    const { entitySchemas } = strapiCustom.schemas;
    let relationsString = relations as string[];

    if (opType === CascadeOperatorEnum.DELETE) {
      if (!relationsString.length) {
        const relationsCascadeTree = getCascadeTree({
          entity,
        });

        relationsString = relationsCascadeTree;
      }

      if (!data.id) {
        throw new Error(`ID not informed ${contextError.context}`);
      }

      const toDelete = await strapiCustom.entityService.findOne(
        entity,
        data.id,
        {
          populate: relations,
        }
      );

      if (!toDelete) {
        throw new Error(`Entity not found ${contextError.context}`);
      }

      Object.assign(data, toDelete);
    }

    if (!data || Object.keys(data).length === 0) {
      throw new Error(`Data not informed ${contextError.context}`);
    }

    if (!entity) {
      throw new Error(`Entity not informed ${contextError.context}`);
    }

    if (["admin::", "plugin::"].some((prefix) => entity.startsWith(prefix))) {
      throw new Error(`Entity not allowed ${contextError.context}`);
    }

    if (!entitySchemas) {
      throw new Error(`Entity Schema not informed ${contextError.context}`);
    }

    operations = getOperations({
      data,
      entitySchemas,
      entity,
      operation: opType,
      options,
    });

    const saved = [];
    const operationLinksCopy = JSON.parse(JSON.stringify(operations)).map(
      (ops) => ({
        ...ops,
        data: {},
      })
    );

    const promise = operations.map(async (operation, index) => {
      try {
        const result = await executeStrapiOperation(operation);

        executedOperations.push({
          target: operation.target,
          result: result as strapiEntity<T>,
          operation: operation.operation,
        });

        const entityId = result?.id || operation?.data?.id;
        if (operation.link_to !== undefined && entityId) {
          if (operation.link_type === LinkTypeEnum.TO_MANY) {
            if (
              !operationLinksCopy[operation.link_to].data[operation.attribute]
            ) {
              operationLinksCopy[operation.link_to].data[operation.attribute] =
                [];
            }

            operationLinksCopy[operation.link_to].data[
              operation.attribute
            ].push(entityId);
          } else {
            operationLinksCopy[operation.link_to].data[operation.attribute] =
              entityId;
          }
        }

        operationLinksCopy[index].data.id = entityId;
        operations[index].data.id = entityId as number;

        saved.push(result);
      } catch (err) {
        failedOperations.push({
          operation: {
            operation: operation.operation,
            target: operation.target,
            data: operation.data,
            result: {} as strapiEntity<T>,
          },
          message: err.message,
        });
      }
    });

    await Promise.all(promise);

    if (failedOperations.length > 0) {
      throw new CascadeStrapiV2Error({
        label: "Cascade Entity Strapi V2",
        type: "CascadeStrapiV2Error (Failed Operations)",
        message: failedOperations[0].message,
        operations: {
          executed: executedOperations,
          failed: failedOperations.map((f) => f.operation),
          operations,
        },
      });
    }

    if (opType !== CascadeOperatorEnum.DELETE) {
      const promiselink = operationLinksCopy.map(async (relation) => {
        if (Object.keys(relation.data).length > 1) {
          // Means that the relation has data besides its own ID
          await executeStrapiOperation({
            data: relation.data,
            target: entity,
            operation: CascadeOperatorEnum.UPDATE,
          });
        }
      });
      await Promise.all(promiselink);
    }

    const reformatted = {} as strapiFilters<T>;

    operations.forEach((operation) => {
      if (
        operation.link_to !== undefined &&
        entitySchemas[operations[operation.link_to].target].attributes[
          operation.attribute
        ].type === "relation"
      ) {
        if (operation.link_type === LinkTypeEnum.TO_MANY) {
          if (!reformatted[operation.attribute]) {
            reformatted[operation.attribute] = [];
          }

          reformatted[operation.attribute].push(operation.data);
        } else {
          reformatted[operation.attribute] = operation.data;
        }
      } else {
        Object.assign(reformatted, operation.data);
      }
    });

    return reformatted;
  } catch (err) {
    if (err instanceof CascadeStrapiV2Error) {
      const { executed } = err.operations;

      if (options.revert_on_error) {
        const promise = executed.map(async (operation) => {
          console.log(
            "🚀 ~ CreateClientService ~ operation.operation:",
            operation
          );
          if (
            operation.operation == CascadeOperatorEnum.CREATE &&
            operation?.result?.id
          ) {
            console.log(
              "🚀 ~ CreateClientService ~ operation.target:",
              `[DELETE]${operation.target}/${operation.result.id}`
            );
            await strapi.entityService.delete(
              operation.target as any,
              operation.result.id
            );
          }
        });

        await Promise.all(promise);
        // TODO - Revert update
      }
    }

    throw err;
    throw new CascadeStrapiV2Error({
      label: "Cascade Entity Strapi V2",
      type: "CascadeStrapiV2Error (Uncaught)",
      message: err.message,
      operations: {
        executed: executedOperations,
        failed: failedOperations.map((f) => f.operation),
        operations,
      },
    });
  }
};

export const removeContextErrorCascade = (message: string) => {
  return message.split("-")[0].trim();
};

export { cascadeEntityStrapiV2, CascadeOperatorEnum };
