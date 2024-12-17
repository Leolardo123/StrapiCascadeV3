// types/generated/custom.d.ts
import { Schema } from '@strapi/strapi';
import * as Params from '@strapi/types/dist/modules/entity-service/params';
import { GetValue } from '@strapi/types/dist/types/core/attributes';
import { UID } from '@strapi/strapi';
import { Input } from '@strapi/types/dist/modules/entity-service/params/data';
import { GetValues, Result } from '@strapi/types/dist/modules/entity-service';


// TODO - If Strapi update breaks this just change to 'any'
type strapiContentType = UID.ContentType;
type strapiEntityService<T extends strapiContentType> = Params.Pick<T, 'fields' | 'filters' | '_q' | 'pagination:offset' | 'sort' | 'populate' | 'publicationState' | 'plugin'>;
type strapiEntity<T extends strapiContentType> = Input<T>;
type strapiFilters<T extends strapiContentType> = Params.Pick<T, 'filters'>['filters'];
type strapiSchema<T extends strapiContentType> = Schema.ContentType<T>;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object
    ? DeepPartial<T[K]> // Recursively apply to nested objects
    : T[K];
};

type DeepPartialEntity<T> = {
  [K in keyof T]?: T[K] extends object
    ? DeepPartial<T[K]> | string | number // Recursively apply to nested objects
    : T[K];
};

type strapiDeepEntity<T extends strapiContentType> = DeepPartialEntity<GetValues<T>>;