'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Promise = require('bluebird');

var BaseAuthorization = require('./base');
var utils = require('../utils');

var UserAuthorization = function (_BaseAuthorization) {
  _inherits(UserAuthorization, _BaseAuthorization);

  function UserAuthorization(opts) {
    _classCallCheck(this, UserAuthorization);

    var _this = _possibleConstructorReturn(this, (UserAuthorization.__proto__ || Object.getPrototypeOf(UserAuthorization)).call(this));

    opts = opts ? opts : {};
    opts = Object.assign({
      relationIdField: 'user_id',
      userIdField: 'id'
    }, opts);

    _this.opts = opts;
    return _this;
  }

  /** UserAuthorization filters the query on opts.relationIdField === req.user[opts.userIdField] */


  _createClass(UserAuthorization, [{
    key: 'preDefault',
    value: function preDefault(bundle) {
      var req = bundle.req;
      bundle.where.push(utils.buildWhereFilter(this.opts.relationIdField, '=', req.user[this.opts.userIdField]));
      return Promise.resolve();
    }
  }, {
    key: 'default',
    value: function _default(bundle) {
      return Promise.resolve();
    }

    /** Make sure resource.body has this.opts.relationIdField and is assigned to req.user[this.opts.userIdField] */

  }, {
    key: 'prePost',
    value: function prePost(bundle) {
      var req = bundle.req;
      bundle.body[this.opts.relationIdField] = req.user[this.opts.userIdField];
      return Promise.resolve();
    }
  }]);

  return UserAuthorization;
}(BaseAuthorization);

module.exports = UserAuthorization;