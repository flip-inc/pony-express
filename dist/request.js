'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var knex = require('knex');
var pathToRegexp = require('path-to-regexp');
var Promise = require('bluebird');

var errors = require('./errors');
var utils = require('./utils');

/**
 * Request pipeline for a resource.
 */

var Request = function () {
  function Request(resource, bundle) {
    _classCallCheck(this, Request);

    this.resource = resource;
    this.bundle = bundle;

    this.processRequest();
  }

  /** Verifies that the request URL is a valid endpoint for this.resource, otherwise respond with a 501. */

  _createClass(Request, [{
    key: 'parseEndpoint',
    value: function parseEndpoint() {
      var _this = this;

      var reqUrl = utils.removeTrailingSlashes(this.bundle.req._parsedUrl.pathname);
      var reqMethod = this.bundle.req.method.toLowerCase();
      var currentEndpoint = false;
      var endpointRegExp = undefined;

      this.resource.allowedEndpoints.forEach(function (endpoint) {
        endpointRegExp = pathToRegexp(_this.resource.getResourcePathForEndpoint(endpoint));
        if (endpointRegExp.test(reqUrl) && (_this.resource.getMethodForEndpoint(endpoint) === reqMethod || reqMethod === 'options')) currentEndpoint = endpoint;
      });

      this.resource.customEndpoints.forEach(function (endpoint) {
        endpointRegExp = pathToRegexp(endpoint.path);
        if (endpointRegExp.test(reqUrl) && (endpoint.method === reqMethod || reqMethod === 'options')) currentEndpoint = endpoint;
      });

      return currentEndpoint;
    }
  }, {
    key: 'processRequest',
    value: function processRequest() {
      var _this2 = this;

      // Determine which endpoint this request is for
      this.endpoint = this.parseEndpoint();

      // If we couldn't identify the endpoint, it's not an implemented endpoint, return 501
      if (this.endpoint === false) return this.bundle.res.sendStatus(501);

      // If it's an OPTIONS request and we have a valid endpoint, immediately return a respond
      if (this.bundle.req.method.toLowerCase() === 'options') return this.bundle.res.sendStatus(200);

      // Normalize methods for custom endpoints vs regular endpoints
      var authenticate = undefined;
      var preAuthorize = undefined;
      var beforeAll = this.resource.beforeAll.bind(this.resource, this.bundle);
      var beforeHandler = undefined;
      var handler = undefined;
      var afterHandler = undefined;
      var afterAll = this.resource.afterAll.bind(this.resource, this.bundle);
      var authorize = undefined;

      // If custom endpoint
      if (utils.isObject(this.endpoint)) {
        authenticate = this.endpoint.skipAuthentication ? function () {
          return Promise.resolve();
        } : this.resource.authentication.authenticate.bind(this.resource.authentication, this.endpoint, this.bundle);
        preAuthorize = this.endpoint.skipAuthorization ? function () {
          return Promise.resolve();
        } : this.resource.authorization.preAuthorize.bind(this.resource.authorization, this.endpoint, this.bundle);
        beforeHandler = this.resource['before' + utils.upperFirst(this.endpoint.handler)].bind(this.resource, this.bundle);
        handler = this.resource[this.endpoint.handler].bind(this.resource, this.bundle);
        afterHandler = this.resource['after' + utils.upperFirst(this.endpoint.handler)].bind(this.resource, this.bundle);
        authorize = this.endpoint.skipAuthorization ? function () {
          return Promise.resolve();
        } : this.resource.authorization.authorize.bind(this.resource.authorization, this.endpoint, this.bundle);
      } else {
        // else, it's a string: `getList`, `getDetail`, etc.
        authenticate = this.resource.authentication.authenticate.bind(this.resource.authentication, this.endpoint, this.bundle);
        preAuthorize = this.resource.authorization.preAuthorize.bind(this.resource.authorization, this.endpoint, this.bundle);
        beforeHandler = this.resource['before' + utils.upperFirst(this.endpoint)].bind(this.resource, this.bundle);
        handler = this.resource[this.endpoint].bind(this.resource, this.bundle);
        afterHandler = this.resource['after' + utils.upperFirst(this.endpoint)].bind(this.resource, this.bundle);
        authorize = this.resource.authorization.authorize.bind(this.resource.authorization, this.endpoint, this.bundle);
      }

      authenticate().then(preAuthorize).then(beforeAll).then(beforeHandler).then(handler).then(afterHandler).then(afterAll).then(authorize).then(function () {
        // Create response
        var fallbackStatus = 200;

        if (_this2.bundle.req.method === 'POST') fallbackStatus = 202;
        if (_this2.bundle.req.method === 'DELETE') fallbackStatus = 204;

        var json = {};
        var cleaned = _this2.bundle.objects ? _this2.resource.toJSON(_this2.bundle.objects, { bundle: _this2.bundle }) : {};

        if (Array.isArray(cleaned)) {
          json.objects = cleaned;
          json.meta = _this2.bundle.meta || {};
        } else {
          json = cleaned;
        }

        if (json) _this2.bundle.res.status(_this2.bundle.statusCode || fallbackStatus).json(json);else _this2.bundle.res.status(_this2.bundle.statusCode || fallbackStatus).send();
      }).catch(errors.CleanExitError, function (err) {
        // Do nothing on CleanExitError
      }).catch(function (err) {
        // Send response
        _this2.resource.errorHandler(err, _this2.bundle.req, _this2.bundle.res, _this2.bundle.next);
      });
    }
  }]);

  return Request;
}();

module.exports = Request;