import {
  IStrapiEntitySchema,
} from "./interface/load-strapi-entity-schemas-v3";

let globalSchema: { [key: string]: IStrapiEntitySchema } = {};
const secretEntities = ["plugin::users-permissions.user"];

const loadStrapiEntitySchemasV3 = async () => {
  const dbSchemaRaw = await strapi.db.connection('strapi_database_schema as db').select('db.schema', 'entity_schema')

  const dbSchema = dbSchemaRaw[0].entity_schema;

  console.log(dbSchema)

  globalSchema = dbSchema;
}

export { loadStrapiEntitySchemasV3, globalSchema, secretEntities };
