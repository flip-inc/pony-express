'use strict';

const BaseAuthentication = require('./base');
const utils = require('../utils');

class UserAuthentication extends BaseAuthentication {

  default(resource, req, res, next) {
    if (!req.user) return res.status(401).send();
    next();
  }

}

module.exports = UserAuthentication;