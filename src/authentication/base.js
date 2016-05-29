'use strict';

const Promise = require('bluebird');

const utils = require('../utils');

class BaseAuthentication {
  
  authenticate(endpoint, bundle) {
    // if endpoint is an object, it's a custom endpoint object
    if (utils.isObject(endpoint)) {

      // if we have a specific "[customEndpoint]" auth method, call it
      if (utils.isFunction(this[endpoint.handler]))
        return this[endpoint.handler].call(this, bundle);

      // otherwise, if we have a "[method]" auth method, call it instead
      if (utils.isFunction(this[endpoint.method]))
        return this[endpoint.method].call(this, bundle);
      
    } else {
      // if endpoint is a string and we have a "[endpoint]" method, call it
      if (utils.isFunction(this[endpoint]))
        return this[endpoint].call(this, bundle);
    }
    
    // finally, if nothing else matches, call the default auth
    return this.default.call(this, bundle);
  }

  default(bundle) {
    return Promise.resolve();
  }

}

module.exports = BaseAuthentication;