'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var BaseAuthorization = require('./base');
var utils = require('../utils');

var UserAuthorization = function (_BaseAuthorization) {
  _inherits(UserAuthorization, _BaseAuthorization);

  function UserAuthorization(opts) {
    _classCallCheck(this, UserAuthorization);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(UserAuthorization).call(this));

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
    value: function preDefault(resource, req, res, next) {
      resource.bundle.where.push(utils.buildWhereFilter(this.opts.relationIdField, '=', req.user[this.opts.userIdField]));
      next();
    }
  }, {
    key: 'default',
    value: function _default(resource, req, res, next) {
      next();
    }

    /** Make sure resource.body has this.opts.relationIdField and is assigned to req.user[this.opts.userIdField] */

  }, {
    key: 'prePost',
    value: function prePost(resource, req, res, next) {
      resource.bundle.body[this.opts.relationIdField] = req.user[this.opts.userIdField];
      next();
    }
  }]);

  return UserAuthorization;
}(BaseAuthorization);

module.exports = UserAuthorization;