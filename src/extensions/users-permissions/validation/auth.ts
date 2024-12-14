'use strict';
const { yup, validateYupSchema } = require('@strapi/utils');
const callbackBodySchema = yup.object().shape({
    password: yup.string().required(),
});
module.exports = {
    validateCallbackBody: validateYupSchema(callbackBodySchema)
};
export {};