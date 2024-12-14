/**
 * article router.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::article.article', {
    config: {
        update: {
            middlewares: [
                {
                    name: 'global::force-keep-relations',
                    config: {
                        entity: 'api::article.article',
                        relations: ['cover']
                    }
                }
            ]
        }
    }
});
