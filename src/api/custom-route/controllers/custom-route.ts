/**
 * custom-route controller
 */

import { factories } from '@strapi/strapi'
import { StrapiCascadeV3 } from '../../../infraestructure/cascade-services/v3/cascade-entity-strapi-v3';

export default factories.createCoreController('api::custom-route.custom-route', {
    async cascadeV3(ctx) {
        return StrapiCascadeV3.cascadeUpsert({
            data: {
                author: {
                    documentId: "whj8g6cq75z6c7opol07swzq",
                    email: "BZ2q7@example.com",
                    avatar: null,
                    name: "asdasd"
                },
                title: 'A new title',
                description: 'A new description',
                cover: null
            },
            target: 'api::article.article',
        })
    }
});
