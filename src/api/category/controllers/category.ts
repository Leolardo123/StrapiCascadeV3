/**
 *  category controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::category.category', {
    createV2: async (ctx) => {
        console.log('ctx', ctx.ip);
        console.log('ctx', ctx.ips);
        console.log('ctx', ctx.request);
        const { name } = ctx.request.body;
    }
});
