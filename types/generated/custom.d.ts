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
type strapiSchema<T extends strapiContentType> = Schema.ContentType<T>;

enum Roles {
  authenticated
}
