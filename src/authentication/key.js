'use strict';

const Promise = require('bluebird');

const BaseAuthentication = require('./base');
const utils = require('../utils');

class KeyAuthentication extends BaseAuthentication {

  constructor(opts) {
    super();
    
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

  default(bundle) {
    return this.Model.forge({ [this.columnName]: req.query[this.param] }).fetch().then((key) => {
      if (!key) return Promise.reject({ errorMessage: 'Authentication required.', statusCode: 401 });
      return Promise.resolve();
    });
  }

}

module.exports = KeyAuthentication;