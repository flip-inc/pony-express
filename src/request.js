'use strict';

const knex = require('knex');
const pathToRegexp = require('path-to-regexp');
const Promise = require('bluebird');

const errors = require('./errors');
const utils = require('./utils');

/**
 * Request pipeline for a resource.
 */
class Request {

  constructor(resource, bundle) {
    this.resource = resource;
    this.bundle = bundle;

    this.processRequest();
  }

  /** Verifies that the request URL is a valid endpoint for this.resource, otherwise respond with a 501. */
  parseEndpoint() {
    const reqUrl = utils.removeTrailingSlashes(this.bundle.req.baseUrl);
    const reqMethod = this.bundle.req.method.toLowerCase();
    let currentEndpoint = false;
    let endpointRegExp;

    this.resource.allowedEndpoints.forEach((endpoint) => {
      endpointRegExp = pathToRegexp(this.resource.getResourcePathForEndpoint(endpoint));
      if (endpointRegExp.test(reqUrl) && (this.resource.getMethodForEndpoint(endpoint) === reqMethod || reqMethod === 'options')) currentEndpoint = endpoint;
    });

    this.resource.customEndpoints.forEach((endpoint) => {
      endpointRegExp = pathToRegexp(endpoint.path);
      if (endpointRegExp.test(reqUrl) && (endpoint.method === reqMethod || reqMethod === 'options')) currentEndpoint = endpoint;
    });
    
    return currentEndpoint;
  }

  processRequest() {
    // Determine which endpoint this request is for
    this.endpoint = this.parseEndpoint();

    // If we couldn't identify the endpoint, it's not an implemented endpoint, return 501
    if (this.endpoint === false) return this.bundle.res.sendStatus(501);

    // If it's an OPTIONS request and we have a valid endpoint, immediately return a respond
    if (this.bundle.req.method.toLowerCase() === 'options') return this.bundle.res.sendStatus(200);

    // Normalize methods for custom endpoints vs regular endpoints
    let authenticate;
    let preAuthorize;
    let beforeAll = this.resource.beforeAll.bind(this.resource, this.bundle);
    let beforeHandler;
    let handler;
    let afterHandler;
    let afterAll = this.resource.afterAll.bind(this.resource, this.bundle);
    let authorize;

    // If custom endpoint
    if (utils.isObject(this.endpoint)) {
      authenticate = this.endpoint.skipAuthentication ? () => { return Promise.resolve(); } : this.resource.authentication.authenticate.bind(this.resource.authentication, this.endpoint, this.bundle);
      preAuthorize = this.endpoint.skipAuthorization ? () => { return Promise.resolve(); } : this.resource.authorization.preAuthorize.bind(this.resource.authorization, this.endpoint, this.bundle);
      beforeHandler = this.resource['before' + utils.upperFirst(this.endpoint.handler)].bind(this.resource, this.bundle);
      handler = this.resource[this.endpoint.handler].bind(this.resource, this.bundle);
      afterHandler = this.resource['after' + utils.upperFirst(this.endpoint.handler)].bind(this.resource, this.bundle);
      authorize = this.endpoint.skipAuthorization ? () => { return Promise.resolve(); } : this.resource.authorization.authorize.bind(this.resource.authorization, this.endpoint, this.bundle);
    } else { // else, it's a string: `getList`, `getDetail`, etc.
      authenticate = this.resource.authentication.authenticate.bind(this.resource.authentication, this.endpoint, this.bundle);
      preAuthorize = this.resource.authorization.preAuthorize.bind(this.resource.authorization, this.endpoint, this.bundle);
      beforeHandler = this.resource['before' + utils.upperFirst(this.endpoint)].bind(this.resource, this.bundle);
      handler = this.resource[this.endpoint].bind(this.resource, this.bundle);
      afterHandler = this.resource['after' + utils.upperFirst(this.endpoint)].bind(this.resource, this.bundle);
      authorize = this.resource.authorization.authorize.bind(this.resource.authorization, this.endpoint, this.bundle);
    }

    authenticate()
      .then(preAuthorize)
      .then(beforeAll)
      .then(beforeHandler)
      .then(handler)
      .then(afterHandler)
      .then(afterAll)
      .then(authorize)
      .then(() => {
      // Create response
      let fallbackStatus = 200;

      if (this.bundle.req.method === 'POST') fallbackStatus = 202;
      if (this.bundle.req.method === 'DELETE') fallbackStatus = 204;

      let json = {};
      let cleaned = this.bundle.objects ? this.resource.toJSON(this.bundle.objects, { bundle: this.bundle }) : {};

      if (Array.isArray(cleaned)) {
        json.objects = cleaned;
        json.meta = this.bundle.meta || {};
      } else {
        json = cleaned;
      }

      if (json) this.bundle.res.status(this.bundle.statusCode || fallbackStatus).json(json);
      else this.bundle.res.status(this.bundle.statusCode || fallbackStatus).send();
    }).catch(errors.CleanExitError, (err) => {
      // Do nothing on CleanExitError
    }).catch((err) => {
      // Send response
      this.resource.errorHandler(err, this.bundle.req, this.bundle.res, this.bundle.next);
    });
  }
}

module.exports = Request;