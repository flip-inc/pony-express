'use strict';

const Promise = require('bluebird');

const BaseAuthentication = require('./base');
const utils = require('../utils');

class UserAuthentication extends BaseAuthentication {

  default(bundle) {
    let req = bundle.req;
    let res = bundle.res;

    if (!req.user) return Promise.reject({ errorMessage: 'Authentication required.', statusCode: 401 });
    
    return Promise.resolve();
  }

}

module.exports = UserAuthentication;