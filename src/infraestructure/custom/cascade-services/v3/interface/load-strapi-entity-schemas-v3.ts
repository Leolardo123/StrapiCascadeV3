import { strapiContentType } from "../../../../../../types/generated/custom";
import { StrapiTypesEnum } from "../../../utils/format-fields-strapi";

interface IInfo {
  singularName: string;
  pluralName: string;
  displayName: string;
  description?: string;
}

interface IOptions {
  draftAndPublish: boolean;
}

interface IPluginOptions {}

export interface IStrapiEntityAttributes {
  type: StrapiTypesEnum;
  relation: "oneToOne" | "oneToMany" | "manyToOne" | "manyToMany";
  target: strapiContentType;
  mappedBy: string;
}

export interface IStrapiEntitySchema {
  kind: StrapiTypesEnum;
  collectionName: string;
  info: IInfo;
  options: IOptions;
  pluginOptions: IPluginOptions;
  attributes: {
    [key: string]: IStrapiEntityAttributes;
  };
}

export interface IStrapiRelational {
  collectionName: string;
  folder: string;
  relations?: {
    [key: string]: {
      type?: string;
      entity?: string;
      target?: string;
      inversedBy?: string;
      relation?: "oneToOne" | "oneToMany" | "manyToOne" | "manyToMany";
    };
  };
  cascade?: {
    delete: string[];
    // update: string[]; // not implemented
  };
}

export interface IStrapiSchemas {
  entitySchemas: {
    [key: string]: IStrapiEntitySchema;
  };
  relationalSchema: {
    [key: string]: IStrapiRelational;
  };
}
