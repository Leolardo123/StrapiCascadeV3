'use strict';
const getService = name => {
    return strapi.plugin('users-permissions').service(name);
};

export{getService}
