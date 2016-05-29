'use strict';

const Promise = require('bluebird');

const BaseAuthorization = require('./base');
const utils = require('../utils');

class UserAuthorization extends BaseAuthorization {

  constructor(opts) {
    super();

    opts = opts ? opts : {};
    opts = Object.assign({
      relationIdField: 'user_id',
      userIdField: 'id',
    }, opts);

    this.opts = opts;
  }

  /** UserAuthorization filters the query on opts.relationIdField === req.user[opts.userIdField] */
  preDefault(bundle) {
    let req = bundle.req;
    bundle.where.push(utils.buildWhereFilter(this.opts.relationIdField, '=', req.user[this.opts.userIdField]));
    return Promise.resolve();
  }

  default(bundle) {
    return Promise.resolve();
  }

  /** Make sure resource.body has this.opts.relationIdField and is assigned to req.user[this.opts.userIdField] */
  prePost(bundle) {
    let req = bundle.req;
    bundle.body[this.opts.relationIdField] = req.user[this.opts.userIdField];
    return Promise.resolve();
  }

}

module.exports = UserAuthorization;