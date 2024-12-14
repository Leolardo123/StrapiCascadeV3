import { Context } from "koa";
import { UID } from "@strapi/strapi"
import { Strapi } from "@strapi/types/dist/core/strapi";
import { ArrayNotation } from "@strapi/types/dist/modules/entity-service/params/populate";
import { Console } from "console";


export default (config: { entity: UID.CollectionType, relations: ArrayNotation<UID.Schema> }, { strapi }: {strapi: Strapi}) => {
  return async (context: Context, next) => {
    console.log("Custom permission handler middleware");
    console.log("Config", config);

    
    if (context.request.method === "PUT" && context.request.body?.data) {
        const { data } = context.request.body;
        const { id } = context.params;
        const { entity, relations } = config;

        console.log("Data", data);

        const exists = await strapi.documents(entity).update({
            documentId: id,
            populate: ['cover'] as any
        });

        console.log("Exists", exists);

        relations.forEach((relation) => {
            if (exists[relation] && !data[relation]) {
                if (Array.isArray(exists[relation])) {
                    data[relation] = exists[relation].map((item) => ({ id: item.id }));
                    return;
                }

                data[relation] = { id: exists[relation].id };
            }
        });

        context.request.body.data = data;
    }

    console.log("Response", context.request.body);
    throw new Error("Custom permission handler middleware");
    await next();
  };
};
