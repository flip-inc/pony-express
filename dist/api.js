'use strict';

/**
 * @class
 */

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Api = function () {
  function Api(opts) {
    _classCallCheck(this, Api);

    this.afterMiddleware = [];
    this.beforeMiddleware = [];
    this.opts = opts || {};
    this.registry = {};
    this.resources = [];

    return this;
  }

  _createClass(Api, [{
    key: 'before',

    /**
     * Install middleware that's run before all resource middleware.
     * @param  {Function} middleware - Express middleware function
     * @return {this}
     */
    value: function before(middleware) {
      this.beforeMiddleware.push(middleware);
    }

    /**
     * Install middleware that's run after all resource middleware.
     * @param  {Function} middleware - Express middleware function
     * @return {this}
     */

  }, {
    key: 'after',
    value: function after(middleware) {
      this.afterMiddleware.push(middleware);
    }

    /**
     * Exposes all resources in this.resources on the given Express app.
     * @param  {Object} app - An express app instance
     * @return {this}
     */

  }, {
    key: 'expose',
    value: function expose(app) {
      var _this = this;

      this.beforeMiddleware.forEach(function (middleware) {
        return app.use(_this.apiRoot + '*', middleware);
      });
      this.resources.forEach(function (resource) {
        return resource.expose(app);
      });
      this.afterMiddleware.forEach(function (middleware) {
        return app.use(_this.apiRoot + '*', middleware);
      });

      return this;
    }

    /**
     * Creates a new instance of a Resource class and pushes it to this.resources.
     * @param  {Resource|Array} Resources – A pony-express Resource class or array of Resources.
     * @param  {Object} [opts]
     * @return {this}
     */

  }, {
    key: 'mount',
    value: function mount(resources, opts) {
      var _this2 = this;

      opts = opts || {};
      opts.api = this;

      if (this.opts.apiRoot) opts.apiRoot = this.opts.apiRoot;

      if (!Array.isArray(resources)) resources = [resources];

      var resource = undefined;
      resources.forEach(function (Resource) {
        resource = new Resource(opts);
        _this2.resources.push(resource);
        _this2.registry[resource.constructor.name] = resource;
      });

      return this;
    }

    /**
     * Adds a resource to this.registry without mounting it on the API and exposing routes.
     * @param  {Object} Resource
     * @return {this}
     */

  }, {
    key: 'register',
    value: function register(Resource) {
      var resource = new Resource({
        api: this
      });

      this.registry[resource.constructor.name] = resource;

      return this;
    }

    /** Error handler middleware */

  }, {
    key: 'errorHandler',
    value: function errorHandler(err, req, res, next) {
      // Check if this is a v1 route
      var json = {};

      Object.assign(json, {
        statusCode: err.statusCode || 500,
        message: err.errorMessage || 'Sorry, we ran in to an error while processing your request. If this problem persists, please contact support.'
      });

      if (err.hasOwnProperty('errorCode')) json.errorCode = err.errorCode;

      res.status(json.statusCode).json(json);
    }
  }, {
    key: 'apiRoot',
    get: function get() {
      return this.opts.apiRoot || '/';
    }
  }]);

  return Api;
}();

module.exports = Api;