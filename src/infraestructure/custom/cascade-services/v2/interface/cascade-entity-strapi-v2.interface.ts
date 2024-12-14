import { Common } from "@strapi/strapi";
import { strapiEntity, strapiEntityService } from "../../../../../../types/generated/custom";
import { IStrapiEntitySchema } from "./load-strapi-entity-schemas.interface";

export interface ICascadeOptions {
  /**
   * @description
   * If true, ignores null values in the data object
   */
  ignore_null?: boolean;
  ignore_not_found?: boolean;
  revert_on_error?: boolean;
  normalize_strings?: boolean;
}

export interface ICascadeEntityStrapiV2<
  T extends Common.UID.ContentType,
  TParams extends strapiEntityService<T>
> {
  data: any;
  entity: T;
  operation?: CascadeOperatorEnum;
  relations?: TParams["populate"];
  options?: ICascadeOptions;
}

export enum LinkTypeEnum {
  TO_ONE = "ToOne",
  TO_MANY = "ToMany",
}

export interface IOperationDTO<T extends Common.UID.ContentType> {
  data: strapiEntity<T>;
  operation: CascadeOperatorEnum;
  entity?: T;
  entitySchemas: {
    [key: string]: IStrapiEntitySchema;
  };
  attribute?: string;
  link_to?: number;
  options?: ICascadeOptions;
  link_type?: LinkTypeEnum;
}

export interface IOperation<T extends Common.UID.ContentType> {
  data: strapiEntity<T>;
  target: T;
  operation: CascadeOperatorEnum;
  attribute?: string;
  link_to?: number;
  link_type?: LinkTypeEnum;
}

export interface IOperationResult<T extends Common.UID.ContentType> {
  target: T;
  result: strapiEntity<T>;
  operation: CascadeOperatorEnum;
  data?: strapiEntity<T>;
}

export interface IGetCascadeTreeDTO {
  entity: string;
  previous?: string; // cascading previous entity ex: user -> user.person -> user.person.card -> ...
}

export enum CascadeOperatorEnum {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
}

export class CascadeStrapiV2Error {
  label: string;

  type: string;

  message: string;

  operations: {
    executed: IOperationResult<Common.UID.ContentType>[];
    failed: IOperationResult<Common.UID.ContentType>[];
    operations: IOperation<Common.UID.ContentType>[];
  };

  constructor({
    label,
    type,
    message,
    operations,
  }: {
    label: string;
    type: string;
    message: string;
    operations: {
      executed: IOperationResult<Common.UID.ContentType>[];
      failed: IOperationResult<Common.UID.ContentType>[];
      operations: IOperation<Common.UID.ContentType>[];
    };
  }) {
    this.label = label;
    this.type = type;
    this.message = message;
    this.operations = operations;
  }
}
