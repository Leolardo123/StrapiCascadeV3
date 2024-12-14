import { strapiEntity } from "../../../../../../types/generated/custom";

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

export enum LinkTypeEnum {
  TO_ONE = "ToOne",
  TO_MANY = "ToMany",
}


export interface CascadeStrapiV3Upsert<T> {
  trx: any,
  data: strapiEntity<T>,
  target: T,
  options?: ICascadeOptions,
  // TODO - Implement ZOD or joi
}
