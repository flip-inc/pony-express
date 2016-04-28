'use strict';

const BaseAuthentication = require('./base');
const utils = require('../utils');

class KeyAuthentication extends BaseAuthentication {

  constructor(opts) {
    opts = Object.assign({
      columnName: 'key',
      Model: false,
      param: 'key'
    }, opts);

    this.columnName = opts.columnName;
    this.Model = opts.Model;
    this.param = opts.param;

    if (!this.Model) throw new Error('A model is required for KeyAuthentication.');
  }

  default(resource, req, res, next) {
    this.Model.forge({ [this.columnName]: req.query[this.param] }).fetch().then((key) => {
      if (!key) return res.status(401).send();
      next();
    });
  }

}

module.exports = KeyAuthentication;