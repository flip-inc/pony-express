'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Promise = require('bluebird');

var BaseAuthentication = require('./base');
var utils = require('../utils');

var KeyAuthentication = function (_BaseAuthentication) {
  _inherits(KeyAuthentication, _BaseAuthentication);

  function KeyAuthentication(opts) {
    _classCallCheck(this, KeyAuthentication);

    var _this = _possibleConstructorReturn(this, (KeyAuthentication.__proto__ || Object.getPrototypeOf(KeyAuthentication)).call(this));

    opts = Object.assign({
      columnName: 'key',
      Model: false,
      param: 'key'
    }, opts);

    _this.columnName = opts.columnName;
    _this.Model = opts.Model;
    _this.param = opts.param;

    if (!_this.Model) throw new Error('A model is required for KeyAuthentication.');
    return _this;
  }

  _createClass(KeyAuthentication, [{
    key: 'default',
    value: function _default(bundle) {
      return this.Model.forge(_defineProperty({}, this.columnName, req.query[this.param])).fetch().then(function (key) {
        if (!key) return Promise.reject({ errorMessage: 'Authentication required.', statusCode: 401 });
        return Promise.resolve();
      });
    }
  }]);

  return KeyAuthentication;
}(BaseAuthentication);

module.exports = KeyAuthentication;