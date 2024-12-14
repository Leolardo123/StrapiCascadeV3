import { Schema } from '@strapi/strapi';
import { Pick } from '@strapi/types/dist/modules/documents/params';
import * as Params from '@strapi/types/dist/modules/entity-service/params';
import { GetValue } from '@strapi/types/dist/types/core/attributes';
import { UID } from '@strapi/strapi';
import { Input } from '@strapi/types/dist/modules/entity-service/params/data';

// TODO - If Strapi update breaks this just change to 'any'
type strapiContentType = UID.ContentType;
type strapiEntityService<T extends strapiContentType> = Pick<T, 'fields' | 'filters' | '_q' | 'pagination:offset' | 'sort' | 'populate' | 'publicationState' | 'plugin'>;
type strapiEntity<T extends strapiContentType> = Input<T>;
type strapiFilters<T extends strapiContentType> = Pick<T, 'filters'>['filters'];

type ExtractNestedRelations<T extends keyof Strapi.ContentTypes> = Strapi.ContentTypes[T]["attributes"] extends infer A
  ? {
      [K in keyof A as IsRelation<A[K]> extends true ? K : never]: A[K] extends { model: infer U }
        ? U extends keyof Strapi.ContentTypes
          ? Input<U> // Single relation (one-to-one, many-to-one)
          : never
        : A[K] extends { collection: infer U }
        ? U extends keyof Strapi.ContentTypes
          ? Input<U>[] // Relation is an array (one-to-many, many-to-many)
          : never
        : never;
    }
  : never;

type ExtractAttributes<T extends keyof Strapi.ContentTypes> = Strapi.ContentTypes[T]["attributes"] extends infer A
  ? {
      [K in keyof A as IsRelation<A[K]> extends false ? K : never]: A[K] extends { type: infer FieldType }
        ? FieldType // Resolve the basic field type
        : never;
    }
  : never;

type IsRelation<T> = T extends { model: any } | { collection: any } ? true : false;


type strapiEntityNested<T extends strapiContentType> = Input<T>;

enum Roles {
  authenticated
}
