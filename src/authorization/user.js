'use strict';

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
  preDefault(resource, req, res, next) {
    resource.bundle.where.push(utils.buildWhereFilter(this.opts.relationIdField, '=', req.user[this.opts.userIdField]));
    next();
  }

  default(resource, req, res, next) {
    next();
  }

  /** Make sure resource.body has this.opts.relationIdField and is assigned to req.user[this.opts.userIdField] */
  prePost(resource, req, res, next) {
    resource.bundle.body[this.opts.relationIdField] = req.user[this.opts.userIdField];
    next();
  }

}

module.exports = UserAuthorization;