'use strict';

const utils = require('../utils');

class BaseAuthorization {
  
  preAuthorize(endpoint, resource, req, res, next) {
    // if endpoint is an object, it's a custom endpoint object
    if (utils.isObject(endpoint)) {

      // if we have a specific "pre[CustomEndpoint]" auth method, call it
      if (utils.isFunction(this['pre' + utils.upperFirst(endpoint.handler)]))
        return this['pre' + utils.upperFirst(endpoint.handler)].call(this, resource, req, res, next);

      // otherwise, if we have a "pre[Method]" auth method, call it instead
      if (utils.isFunction(this['pre' + utils.upperFirst(endpoint.method)]))
        return this['pre' + utils.upperFirst(endpoint.method)].call(this, resource, req, res, next);
    } else {
      // if endpoint is a string and we have a "pre[Endpoint]" method, call it
      if (utils.isFunction(this['pre' + utils.upperFirst(endpoint)]))
        return this['pre' + utils.upperFirst(endpoint)].call(this, resource, req, res, next);
    }
    
    // finally, if nothing else matches, call the default auth
    this.preDefault.call(this, resource, req, res, next);
  }

  authorize(endpoint, resource, req, res, next) {
    // if endpoint is an object, it's a custom endpoint object
    if (utils.isObject(endpoint)) {

      // if we have a specific "[customEndpoint]" auth method, call it
      if (utils.isFunction(this[endpoint.handler]))
        return this[endpoint.handler].call(this, resource, req, res, next);

      // otherwise, if we have a "[method]" auth method, call it instead
      if (utils.isFunction(this[endpoint.method]))
        return this[endpoint.method].call(this, resource, req, res, next);
    } else {
      // if endpoint is a string and we have a "[endpoint]" method, call it
      if (utils.isFunction(this[endpoint]))
        return this[endpoint].call(this, resource, req, res, next);
    }
    
    // finally, if nothing else matches, call the default auth
    this.default.call(this, resource, req, res, next);
  }

  preDefault(resource, req, res, next) {
    next();
  }

  default(resource, req, res, next) {
    next();
  }
  

}

module.exports = BaseAuthorization;