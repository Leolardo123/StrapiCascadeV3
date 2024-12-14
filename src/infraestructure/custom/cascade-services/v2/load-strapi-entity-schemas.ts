import * as fs from "fs";
import * as path from "path";
import {
  IStrapiEntitySchema,
  IStrapiRelational,
  IStrapiSchemas,
} from "./interface/load-strapi-entity-schemas.interface";

const relativePath = path
  .resolve(__dirname, "../../src/api")
  .replace("\\dist", "")
  .replace("/dist", "");

let globalSchema: { [key: string]: IStrapiEntitySchema } = {};
const secretEntities = ["plugin::users-permissions.user"];

const readVerifyJSON = <T>(folderPath: string[], fileName: string): T => {
  const fileExists = fs.existsSync(path.resolve(...folderPath, fileName));

  if (!fileExists) return null;

  const entitySchemaPath = fs.readFileSync(
    path.resolve(...folderPath, fileName),
    "utf-8"
  );

  return JSON.parse(entitySchemaPath.toString());
};

const fileOlderThan = (file: fs.Stats, date: Date): boolean => {
  return file.mtimeMs < date.getTime();
};

const loadStrapiEntitySchemas = async ({
  refresh_relations = false,
  create_cascade_schemas = false,
} = {}): Promise<IStrapiSchemas> => {
  const meta = "load-strapi-entity-schema-meta.json";

  const metaJSON = readVerifyJSON<{ lastModified: Date }>([relativePath], meta);

  const entityFolders = fs.readdirSync(relativePath);
  const entitySchemas = {} as { [key: string]: IStrapiEntitySchema };

  const relationalSchema = {} as { [key: string]: IStrapiRelational };
  const mode = refresh_relations ? "NEW" : "DISK";

  const promise = entityFolders.map((entityFolder) => {
    if (!fs.lstatSync(path.resolve(relativePath, entityFolder)).isDirectory())
      return null;

    try {
      const entityFolderPath = [
        relativePath,
        entityFolder,
        "content-types",
        entityFolder,
      ];

      const parsed = readVerifyJSON<IStrapiEntitySchema>(
        entityFolderPath,
        "schema.json"
      ) as IStrapiEntitySchema;

      if (!parsed) return null;

      const sName = parsed.info.singularName;
      const name = `api::${entityFolder}.${sName}`;
      entitySchemas[name] = parsed;

      const newSchema =
        (readVerifyJSON<IStrapiRelational>(
          entityFolderPath,
          "schema-relational.json"
        ) as IStrapiRelational) ||
        ({
          collectionName: sName,
          relations: {},
        } as IStrapiRelational);

      const entityStats = fs.lstatSync(
        path.resolve(...entityFolderPath, "schema.json")
      );

      if (
        entityStats &&
        metaJSON &&
        (fileOlderThan(entityStats, new Date(metaJSON.lastModified)) ||
          !refresh_relations)
      ) {
        entitySchemas[name] = parsed;
        relationalSchema[name] = newSchema;

        return null;
      }

      if (create_cascade_schemas) {
        console.log(
          `${entityFolder} is older than ${new Date(
            metaJSON?.lastModified
          )} and will be updated.`
        );

        Object.entries(parsed.attributes).forEach(([key, value]) => {
          if (value.type !== "relation") return null;

          if (!newSchema.relations[key]) {
            newSchema.relations[key] = {};
          }

          Object.assign(newSchema.relations[key], value);

          return null;
        });

        if (newSchema.cascade) {
          Object.entries(newSchema.cascade).forEach(
            ([keyOperator, cascadeEntities]: [string, string[]]) => {
              const newCascade = cascadeEntities.filter((entity, index) => {
                strapi.log.debug(
                  `Checking cascade for (${sName})[${index}] -> (${entity})`
                );
                if (newSchema.relations[entity]) {
                  const inverseRelation = // Check if the relation has a circular cascade
                    relationalSchema[newSchema.relations[entity].target];

                  if (inverseRelation) {
                    if (
                      inverseRelation.cascade[keyOperator].some(
                        // Check if cascade targets the current entity
                        (r) => inverseRelation.relations[r].target == name
                      )
                    ) {
                      strapi.log.warn(
                        `Entity (${sName}) has a circular cascade [${keyOperator}] relation with (${entity}) and should be removed from the cascade list.`
                      );
                    }
                  }

                  return true;
                }

                return false;
              });

              newSchema.cascade[keyOperator] = newCascade;
            }
          );
        }

        if (!newSchema.cascade) {
          newSchema.cascade = {
            delete: [],
          };
        }

        relationalSchema[name] = newSchema;


        fs.writeFileSync(
          path.resolve(...entityFolderPath, "schema-relational.json"),
          JSON.stringify(relationalSchema[name], null, 2)
        );
      }

      relationalSchema[name].folder = entityFolderPath
        .join("/")
        .concat("/schema-relational.json");
    } catch (e) {
      console.error(e);
    }

    return null;
  });

  await Promise.all(promise);
  console.timeEnd(`loadStrapiEntitySchemas(${mode})`);

  if (!create_cascade_schemas) {
    return {
      entitySchemas,
      relationalSchema,
    };
  }

  fs.writeFileSync(
    path.resolve(relativePath, meta),
    JSON.stringify({ lastModified: Date.now() }, null, 2)
  );

  globalSchema = entitySchemas;
};

export { loadStrapiEntitySchemas, globalSchema, secretEntities };
