'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Promise = require('bluebird');

var utils = require('../utils');

var BaseAuthentication = function () {
  function BaseAuthentication() {
    _classCallCheck(this, BaseAuthentication);
  }

  _createClass(BaseAuthentication, [{
    key: 'authenticate',
    value: function authenticate(endpoint, bundle) {
      // if endpoint is an object, it's a custom endpoint object
      if (utils.isObject(endpoint)) {

        // if we have a specific "[customEndpoint]" auth method, call it
        if (utils.isFunction(this[endpoint.handler])) return this[endpoint.handler].call(this, bundle);

        // otherwise, if we have a "[method]" auth method, call it instead
        if (utils.isFunction(this[endpoint.method])) return this[endpoint.method].call(this, bundle);
      } else {
        // if endpoint is a string and we have a "[endpoint]" method, call it
        if (utils.isFunction(this[endpoint])) return this[endpoint].call(this, bundle);
      }

      // finally, if nothing else matches, call the default auth
      return this.default.call(this, bundle);
    }
  }, {
    key: 'default',
    value: function _default(bundle) {
      return Promise.resolve();
    }
  }]);

  return BaseAuthentication;
}();

module.exports = BaseAuthentication;