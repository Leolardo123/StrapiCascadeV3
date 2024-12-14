/**
 * custom-route controller
 */

import { factories } from '@strapi/strapi'
import { StrapiCascadeV3 } from '../../../infraestructure/custom/cascade-services/v3/cascade-entity-strapi-v3';

export default factories.createCoreController('api::custom-route.custom-route', {
    async cascadeV3(ctx) {
        const result = await StrapiCascadeV3.cascadeUpsert({
            target: "api::category.category",
            data: {
                name: "test",
                slug: "test",
                description: "testcasce",
                articles: [
                    {
                        title: "testcascade",
                    }
                ]
            }
        })
        
        return result
    }
});
