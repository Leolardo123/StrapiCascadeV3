import * as Params from '@strapi/types/dist/modules/entity-service/params';
import { GetValue } from '@strapi/types/dist/types/core/attributes';

// TODO - If Strapi update breaks this just change to 'any'
type strapiEntityService<T extends Common.UID.ContentType> = Params.Pick<T, 'fields' | 'filters' | '_q' | 'pagination:offset' | 'sort' | 'populate' | 'publicationState' | 'plugin'>;
type strapiEntity<T extends Common.UID.ContentType> = Params.Pick<T, 'data'>['data'];
type strapiFilters<T extends Common.UID.ContentType> = Params.Pick<T, 'filters'>['filters'];

enum Roles {
  authenticated
}
