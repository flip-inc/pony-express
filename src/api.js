'use strict';

/**
 * @class
 */
class Api {

  constructor(opts) {
    this.afterMiddleware = [];
    this.beforeMiddleware = [];
    this.opts = opts || {};
    this.registry = {};
    this.resources = [];

    return this;
  }

  get apiRoot() {
    return this.opts.apiRoot || '/';
  }

  /**
   * Install middleware that's run before all resource middleware.
   * @param  {Function} middleware - Express middleware function
   * @return {this}
   */
  before(middleware) {
    this.beforeMiddleware.push(middleware);
  }

  /**
   * Install middleware that's run after all resource middleware.
   * @param  {Function} middleware - Express middleware function
   * @return {this}
   */
  after(middleware) {
    this.afterMiddleware.push(middleware);
  }

  /**
   * Exposes all resources in this.resources on the given Express app.
   * @param  {Object} app - An express app instance
   * @return {this}
   */
  expose(app) {
    this.beforeMiddleware.forEach(middleware => app.use(this.apiRoot + '*', middleware));
    this.resources.forEach(resource => resource.expose(app));
    this.afterMiddleware.forEach(middleware => app.use(this.apiRoot + '*', middleware));

    return this;
  }

  /**
   * Creates a new instance of a Resource class and pushes it to this.resources.
   * @param  {Resource|Array} Resources – A pony-express Resource class or array of Resources.
   * @param  {Object} [opts]
   * @return {this}
   */
  mount(resources, opts) {
    opts = opts || {};
    opts.api = this;

    if (this.opts.apiRoot) opts.apiRoot = this.opts.apiRoot;

    if (!Array.isArray(resources)) resources = [resources];

    let resource;
    resources.forEach((Resource) => {
      resource = new Resource(opts);
      this.resources.push(resource);
      this.registry[resource.constructor.name] = resource;
    });

    return this;
  }

  /**
   * Adds a resource to this.registry without mounting it on the API and exposing routes.
   * @param  {Object} Resource
   * @return {this}
   */
  register(Resource) {
    let resource = new Resource({
      api: this
    });

    this.registry[resource.constructor.name] = resource;

    return this;
  }

  /** Error handler middleware */
  errorHandler(err, req, res, next) {
    // Check if this is a v1 route
    let json = {};

    Object.assign(json, {
      statusCode: err.statusCode || 500,
      message: err.errorMessage || 'Sorry, we ran in to an error while processing your request. If this problem persists, please contact support.'
    });

    if (err.hasOwnProperty('errorCode')) json.errorCode = err.errorCode;

    res.status(json.statusCode).json(json);
  }

}

module.exports = Api;