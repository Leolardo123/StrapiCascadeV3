//import { Populate } from "@strapi/strapi/lib/services/entity-service/types/params";
const utils = require('@strapi/utils');
const { getService } = require('./utils');
const jwt = require('jsonwebtoken');
const lodash = require('lodash');
const {
  validateCallbackBody
} = require('./validation/auth');

const { setMaxListeners } = require('process');
const { sanitize } = utils;
const { ApplicationError, ValidationError } = utils.errors;

const sanitizeEntityCustom = (entity, schema) => {// eslint-disable-line
  const attributes = schema.attributes;
  const cloneEntity = { ...entity };

  Object.keys(cloneEntity).forEach((key) => {
    if (key in attributes && attributes[key].private) {
      delete cloneEntity[key];
    }
  })

  return cloneEntity;
}

const sanitizeUser = (user, ctx) => {
  const { auth } = ctx.state;
  const userSchema = strapi.getModel('plugin::users-permissions.user');
  
  return sanitizeEntityCustom(user, userSchema);
};

// ../users-permissions/strapi-server.js

module.exports = (plugin) => {
  plugin.controllers.auth.callback = async (ctx) => {
    console.log('teste')
    const provider = ctx.params.provider || 'local';
    const params = ctx.request.body;
    const store = strapi.store({ type: 'plugin', name: 'users-permissions' });
    const grantSettings = await store.get({ key: 'grant' });
    const grantProvider = provider === 'local' ? 'email' : provider;
    if (!lodash.get(grantSettings, [grantProvider, 'enabled'])) {
      throw new ApplicationError('This provider is disabled');
    }
    if (provider === 'local') {
      await validateCallbackBody(params);
      const { identifier } = params;
      // Check if the user exists.
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: {
          provider,
          $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
        },
        populate: ["role"]
      });
      if (!user) {
        throw new ValidationError('Senha ou email inválidos');
      }
      if (!user.password) {
        throw new ValidationError('Senha ou email inválidos');
      }
      const validPassword = await getService('user').validatePassword(
        params.password,
        user.password
      );
      if (!validPassword) {
        throw new ValidationError('Senha ou email inválidos');
      } else {
        ctx.cookies.set("refreshToken", issueRefreshToken({ id: user.id }), {
          httpOnly: true,
          secure: false,
          signed: true,
          overwrite: true,
        });
        ctx.send({
          status: 'Authenticated',
          jwt: issueJWT({ id: user.id }, { expiresIn: process.env.JWT_SECRET_EXPIRES }),
          user: await sanitizeUser(user, ctx),
          refreshToken: issueRefreshToken({ id: user.id }),
        });
      }
      const advancedSettings = await store.get({ key: 'advanced' });
      const requiresConfirmation = lodash.get(advancedSettings, 'email_confirmation');
      if (requiresConfirmation && user.confirmed !== true) {
        throw new ApplicationError('Your account email is not confirmed');
      }
      if (user.blocked === true) {
        throw new ApplicationError('Your account has been blocked by an administrator');
      }
      return ctx.send({
        jwt: getService('jwt').issue({ id: user.id }),
        user: {
          ...await sanitizeUser(user, ctx),
          role: user.role
        },
        refreshToken: issueRefreshToken({ id: user.id }),
      });
    }
    // Connect the user with a third-party provider.
    try {

      const user = await getService('providers').connect(provider, ctx.query);
      return ctx.send({
        jwt: getService('jwt').issue({ id: user.id }),
        user: await sanitizeUser(user, ctx),
      });
    } catch (error) {
      throw new ApplicationError(error.message);
    }
  }


  plugin.controllers.auth['refreshToken'] = async (ctx) => {
    console.log("???")
    const store = await strapi.store({ type: 'plugin', name: 'users-permissions' });
    const { refreshToken } = ctx.request.body;
    let refreshCookie = ctx.cookies.get("refreshToken")
    console.log("Ta batendo???")
    if (!refreshCookie && !refreshToken) {
      return ctx.badRequest("No Authorization");
    }
    if (!refreshCookie) {
      if (refreshToken) {
        refreshCookie = refreshToken
      }
      else {
        return ctx.badRequest("No Authorization");
      }
    }
    try {
      const obj = await verifyRefreshToken(refreshCookie) as any;

      const user = await strapi.query('plugin::users-permissions.user').findOne({ where: { id: obj.id } });
      if (!user) {
        throw new ValidationError('Senha ou email inválidos');
      }
      if (
        lodash.get(await store.get({ key: 'advanced' }), 'email_confirmation') &&
        user.confirmed !== true
      ) {
        throw new ApplicationError('Your account email is not confirmed');
      }
      if (user.blocked === true) {
        throw new ApplicationError('Your account has been blocked by an administrator');
      }
      const refreshToken = issueRefreshToken({ id: user.id })
      ctx.cookies.set("refreshToken", refreshToken, {
        httpOnly: true,
        secure: false,
        signed: true,
        overwrite: true,
      });
      ctx.send({
        jwt: issueJWT({ id: obj.id }, { expiresIn: process.env.JWT_SECRET_EXPIRES }),
        refreshToken: refreshToken,
        user: await sanitizeUser(user, ctx),
      });
    }
    catch (err) {
      return ctx.badRequest(err.toString());
    }
  }


  plugin.routes['content-api'].routes.push({
    method: 'POST',
    path: '/auth/refresh-token',
    handler: 'auth.refreshToken',
    config: {
      prefix: '',
    }
  });

  return plugin
}
// issue a JWT
const issueJWT = (payload, jwtOptions = {}) => {
  lodash.defaults(jwtOptions, strapi.config.get('plugin.users-permissions.jwt'));
  return jwt.sign(
    lodash.clone(payload.toJSON ? payload.toJSON() : payload),
    strapi.config.get('plugin.users-permissions.jwtSecret'),
    jwtOptions
  );
}

// verify the refreshToken by using the REFRESH_SECRET from the .env
const verifyRefreshToken = (token) => {
  return new Promise(function (resolve, reject) {
    jwt.verify(token, process.env.REFRESH_SECRET, {}, function (
      err,
      tokenPayload = {}
    ) {
      if (err) {
        return reject(new Error('Invalid token.'));
      }
      resolve(tokenPayload);
    });
  });
}

// issue a Refresh token
const issueRefreshToken = (payload, jwtOptions = {}) => {
  lodash.defaults(jwtOptions, strapi.config.get('plugin.users-permissions.jwt'));
  return jwt.sign(
    lodash.clone(payload.toJSON ? payload.toJSON() : payload),
    process.env.REFRESH_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES }
  );
}
