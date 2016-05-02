'use strict';

const knex = require('knex');
const pathToRegexp = require('path-to-regexp');

const authentication = require('./authentication');
const authorization = require('./authorization');
const utils = require('./utils');

/** Resource */
class Resource {

  constructor(opts) {
    this.opts = opts || {};

    // Initialize the resource, properties should be assigned here.
    this.initialize();

    // Parse
    this._verifyRequiredProps();
    this._parseOpts();
    this._parseProps();
    this._setDefaults();
  }

  initialize() {
    throw new Error(this.constructor.name + ' must implement `initialize()` to define properties.');
  }

  /**
   * Throws an error if a Resource is created without assigning the required properties.
   *
   * Required properties:
   *   `Model` - The Bookshelf Model classes to use for this resource.
   */
  _verifyRequiredProps() {
    if (!this.Model) throw new Error(this.constructor.name + ' must assign this.Model to be a Bookshelf.Model.');
  }

  /**
   * Parse this.opts and maps valid options back to this.
   */
  _parseOpts() {
    const validOptions = [
      'api',
      'apiRoot',
    ];

    validOptions.forEach((opt) => {
      if (this.opts[opt] && !this[opt]) this[opt] = this.opts[opt];
    });
  }

  /**
   * Parses properties consistency.
   */
  _parseProps() {
    // Convert 'get' option to 'getList' and 'getDetail' in this.allowedEndpoints
    if (this.allowedEndpoints && ~this.allowedEndpoints.indexOf('get')) {
      let getIndex = this.allowedEndpoints.indexOf('get');
      this.allowedEndpoints.splice(getIndex, 1, 'getList', 'getDetail');
    }

    // Normalize this.apiRoot
    if (this.apiRoot) this.apiRoot = '/' + utils.removeLeadingAndTrailingSlashes(this.apiRoot);

    // Normalize this.identifier
    if (this.identifier) this.identifier = ':' + this.identifier.replace(/^:/g, '');
  }

  /**
   * Set default Resource properties.
   */
  _setDefaults() {
    const defaultIdentifier = this.identifier || ':id';
    const normalizedIdentifier = defaultIdentifier.replace(/^:/g, '');

    // Defaults
    if (!this.allowedEndpoints) this.allowedEndpoints = ['getList', 'getDetail', 'post', 'put', 'delete'];
    if (!this.allowedFilters) this.allowedFilters = 'ALL';
    if (!this.allowedIncludes) this.allowedIncludes = 'ALL';
    if (!this.allowedOrderBy) this.allowedOrderBy = 'ALL';
    if (!this.apiRoot) this.apiRoot = '';
    if (!this.authentication) this.authentication = new authentication.BaseAuthentication();
    if (!this.authorization) this.authorization = new authorization.BaseAuthorization();
    if (!this.customEndpoints) this.customEndpoints = [];
    if (!this.customParams) this.customParams = [];
    if (!this.fields) this.fields = 'ALL';
    if (!this.identifier) this.identifier = defaultIdentifier;
    this.identifierField = normalizedIdentifier;
    if (!this.include) this.include = [];
    if (!this.limit) this.limit = 100;
    if (!this.offset) this.offset = 0;
    if (!this.orderBy) this.orderBy = [this.identifierField, 'DESC'];
    if (!this.resourceName) this.resourceName = this.Model.prototype.tableName;
    if (!this.virtuals) this.virtuals = [];
    if (!this.where) this.where = [];

    // Advanced defaults
    if (utils.isObject(this.allowedOrderBy) && !~this.allowedOrderBy.indexOf(this.identifierField)) this.allowedOrderBy.push(this.identifierField);
    if (this.customEndpoints.length) this.customEndpoints = this.customEndpoints.map((endpoint => this.parseCustomEndpoint(endpoint)));
    if (utils.isString(this.orderBy)) this.orderBy = [this.orderBy, 'DESC'];
    if (!utils.isString(this.fields) && !Array.isArray(this.fields)) {
      this.fields = Object.keys(this.fields).reduce((fields, field) => {
        fields[field] = Object.assign({ hidden: false, readOnly: false, required: false, related: false, full: false, pivotAttrs: false, virtual: false }, this.fields[field]);
        return fields;
      }, {});
    }
    if (this.where.length && !Array.isArray(this.where[0])) this.where = [this.where];
  }

  /** Verifies that the request URL is a valid endpoint, otherwise respond with a 501. */
  _verifyEndpoint(req, res, next) {
    const reqUrl = utils.removeTrailingSlashes(req.baseUrl);
    const reqMethod = req.method.toLowerCase();
    let isValid = false;
    let endpointRegExp;

    this.allowedEndpoints.forEach((endpoint) => {
      endpointRegExp = pathToRegexp(this.getResourcePathForEndpoint(endpoint));
      if (endpointRegExp.test(reqUrl) && this.getMethodForEndpoint(endpoint) === reqMethod) isValid = true;
    });

    this.customEndpoints.forEach((endpoint) => {
      endpointRegExp = pathToRegexp(endpoint.path);
      if (endpointRegExp.test(reqUrl) && endpoint.method === reqMethod) isValid = true;
    });

    if (reqMethod === 'options') isValid = true;

    if (!isValid) return res.status(501).send();
    
    next();
  }

  /**
   * Exposes resource endpoints on the app and installs appropriate middleware.
   * @param  {Object} app - Express app.
   * @return {this}
   */
  expose(app) {
    const catchAllResourceUrl = this.apiRoot + '/' + this.resourceName + '*';
    let beforeAll = utils.isFunction(this.beforeAll) ? this.beforeAll : (req, res, next) => { next(); };
    let afterAll = utils.isFunction(this.afterAll) ? this.afterAll : (req, res, next) => { next(); };
    let beforeHook;
    let afterHook;

    // Handle preflight OPTIONS request to resource
    // TODO: MAKE BETTER
    app.options(catchAllResourceUrl, (req, res, next) => { next(); });
    
    // Create before/after hooks for allowedEndpoints
    this.allowedEndpoints.forEach((endpoint) => {
      beforeHook = 'before' + utils.upperFirst(endpoint);
      afterHook = 'after' + utils.upperFirst(endpoint);
      if (!this[beforeHook]) this[beforeHook] = (req, res, next) => { next(); };
      if (!this[afterHook]) this[afterHook] = (req, res, next) => { next(); };
    });

    // Create before/after hooks for customEndpoints
    this.customEndpoints.forEach((endpoint) => {
      if (!utils.isFunction(this[endpoint.handler])) throw new Error(this.constructor.name + ' is missing the handler method for ' + endpoint.path + '.');
      beforeHook = 'before' + utils.upperFirst(endpoint.handler);
      afterHook = 'after' + utils.upperFirst(endpoint.handler);
      if (!this[beforeHook]) this[beforeHook] = (req, res, next) => { next(); };
      if (!this[afterHook]) this[afterHook] = (req, res, next) => { next(); };
    });

    // Verify the current endpoint is valid.
    app.use(catchAllResourceUrl, this._verifyEndpoint.bind(this));
    
    // Build our `bundle` that can be used by other middleware to modify the resource query.
    app.use(catchAllResourceUrl, this.buildBundle.bind(this));

    // Bind allowedEndpoints
    this.allowedEndpoints.forEach((endpoint) => {
      beforeHook = 'before' + utils.upperFirst(endpoint);
      afterHook = 'after' + utils.upperFirst(endpoint);

      app[this.getMethodForEndpoint(endpoint)](
        this.getResourcePathForEndpoint(endpoint),
        beforeAll.bind(this),
        this.authentication.authenticate.bind(this.authentication, endpoint, this),
        this.authorization.preAuthorize.bind(this.authorization, endpoint, this),
        this[beforeHook].bind(this),
        this['_' + endpoint].bind(this),
        this[afterHook].bind(this),
        this.authorization.authorize.bind(this.authorization, endpoint, this),
        afterAll.bind(this)
      );
    });

    // Bind customEndpoints
    this.customEndpoints.forEach((endpoint) => {
      beforeHook = 'before' + utils.upperFirst(endpoint.handler);
      afterHook = 'after' + utils.upperFirst(endpoint.handler);

      app[endpoint.method](
        endpoint.path,
        beforeAll.bind(this),
        endpoint.skipAuthentication ? (req, res, next) => { next(); } : this.authentication.authenticate.bind(this.authentication, endpoint, this),
        endpoint.skipAuthorization ? (req, res, next) => { next(); } : this.authorization.preAuthorize.bind(this.authorization, endpoint, this),
        this[beforeHook].bind(this),
        this[endpoint.handler].bind(this),
        this[afterHook].bind(this),
        endpoint.skipAuthorization ? (req, res, next) => { next(); } : this.authorization.authorize.bind(this.authorization, endpoint, this),
        afterAll.bind(this)
      )
    });

    // Bind final response
    app.use(catchAllResourceUrl, this.createResponse.bind(this));

    // Bind error handler
    if (this.api) app.use(catchAllResourceUrl, this.api.errorHandler.bind(this));
    else app.use(catchAllResourceUrl, this.errorHandler.bind(this));
  }

  /**
   * Given a customEndpoint string, parse it and return a normalized endpoint object.
   * @param  {String} endpoint
   * @return {Object}
   */
  parseCustomEndpoint(endpoint) {
    let endpointParts = endpoint.split(' ');
    let methodAndListOrDetail = endpointParts[0].split('#');
    let method = methodAndListOrDetail[0].toLowerCase();
    let listOrDetail = methodAndListOrDetail.length > 1 ? methodAndListOrDetail[1] : 'detail';
    let path = this['getFull' + utils.upperFirst(listOrDetail) + 'Endpoint'](endpointParts[1]);
    let handler = endpointParts.length > 2 && !~['skipAuthentication', 'skipAuthorization'].indexOf(endpointParts[2]) ? endpointParts[2] : endpointParts[1];

    return {
      handler: handler,
      method: method,
      path: path,
      skipAuthentication: Boolean(~endpointParts.indexOf('skipAuthentication')),
      skipAuthorization: Boolean(~endpointParts.indexOf('skipAuthorization'))
    };
  }

  /**
   * Given a partial endpoint string, returns a full endpoint string for this resource. 
   * @param  {String} endpointSegment
   * @return {String}
   */
  getFullListEndpoint(endpointSegment) {
    return this.apiRoot + '/' + this.resourceName + '/' + utils.removeLeadingAndTrailingSlashes(endpointSegment);
  }

  /**
   * Given a partial endpoint string, returns a full endpoint string for this resource. 
   * @param  {String} endpointSegment
   * @return {String}
   */
  getFullDetailEndpoint(endpointSegment) {
    return this.apiRoot + '/' + this.resourceName + '/' + this.identifier + '/' + utils.removeLeadingAndTrailingSlashes(endpointSegment);
  }

  /**
   * Given a endpoint string, returns the full resource URL
   * @param  {String} endpoint
   * @return {String}
   */
  getResourcePathForEndpoint(endpoint) {
    let resourceUrl;

    switch (endpoint) {
      case 'getList':
      case 'post':
        resourceUrl = this.apiRoot + '/' + this.resourceName;
        break;
      case 'getDetail':
      case 'put':
      case 'delete':
        resourceUrl = this.apiRoot + '/' + this.resourceName + '/' + this.identifier;
        break;
    }

    return resourceUrl;
  }

  /**
   * Given a endpoint string, returns the HTTP request type
   * @param  {String} endpoint
   * @return {String}
   */
  getMethodForEndpoint(endpoint) {
    return (endpoint === 'getList' || endpoint === 'getDetail') ? 'get' : endpoint;
  }

  /**
   * Iterates through this.fields, looks for required fields, and makes sure they're in body.
   * @param {Object} body The req.body fields to validate
   * @return {Boolean|Object} Returns true if valid or an error object if fields are missing
   */
  validateRequiredFields(body, requiredFields) {
    if (this.fields === 'ALL' && !requiredFields) return true;

    requiredFields = requiredFields || Object.keys(this.fields).filter(field => this.fields[field].required);
    
    let missingFields = [];
    for (let field of requiredFields) {
      if (!~Object.keys(body).indexOf(field)) missingFields.push(field);
    }

    if (missingFields.length > 0) {
      return {
        errorMessage: 'The following required field(s) are missing: ' + missingFields.join(', ') + '.',
        statusCode: 400
      };
    }

    return true;
  }

  /**
   * Filters req.body and returns only allowed options.
   * @param  {Object} request.body
   * @return {Object}
   */
  buildBody(body) {
    let bodyCopy = Object.assign({}, body);
    let filtered = {};

    if (this.fields === 'ALL') return bodyCopy;

    if (Array.isArray(this.fields)) {
      this.fields.forEach((field) => {
        if (bodyCopy.hasOwnProperty(field)) filtered[field] = bodyCopy[field];
      });
    } else {
      let field;
      for (let fieldName of Object.keys(bodyCopy)) {
        field = this.fields[fieldName];
        if (!field || field.readOnly || field.virtual || field.related) continue;
        if (this.fields.hasOwnProperty(fieldName)) filtered[fieldName] = bodyCopy[fieldName];
      }
    }

    return filtered;
  }

  /**
   * Builds an array of where filters to apply to the query
   * @return {Array}
   */
  buildWhere() {
    let query = this.bundle.query;
    let where = [];
    let filterType;
    let filterParts;
    let columnName;

    // loop over this.bundle.filters and build the where object
    this.bundle.filters.forEach((filter) => {
      filterParts = filter.split('__');
      columnName = filterParts[0];
      filterType = filterParts.length > 1 ? filterParts[1] : 'equal';

      where.push(utils.buildWhereFilter(columnName, filterType, query[filter]));
    });

    // Add default where clauses from the resource
    this.where.forEach((whereClause) => {
      if (utils.isFunction(whereClause)) return where.push(whereClause.call(this));
      where.push(whereClause);
    });

    this.bundle.where = where;

    return this;
  }

  /**
   * Given the filtered query object, build orderBy and put it on this.bundle
   * @return {this}
   */
  buildOrderBy() {
    let query = this.bundle.query;
    let orderBy = this.orderBy;
    let validOrderOptions = [];
    let queryOrderOptions;

    if (query.orderBy) {
      queryOrderOptions = query.orderBy.split(',');

      if (utils.isString(this.allowedOrderBy) && this.allowedOrderBy === 'ALL') {
        validOrderOptions = queryOrderOptions;
      } else {
        queryOrderOptions.forEach((opt) => {
          if (~this.allowedOrderBy.indexOf(opt)) validOrderOptions.push(opt);
        });
      }

      if (validOrderOptions.length) orderBy = [validOrderOptions.join(','), orderBy[1]];
    }

    if (query.orderDirection) orderBy = [orderBy[0], query.orderDirection];

    this.bundle.orderBy = orderBy;

    return this;
  }

  /**
   * [buildInclude description]
   * @return {[type]} [description]
   */
  buildInclude() {
    let query = this.bundle.query;
    let include = query.include ? query.include.split(',') : [];

    this.bundle.include = [].concat(this.include);

    if (include.length > 0) {
      if (utils.isString(this.allowedIncludes) && this.allowedIncludes === 'ALL') {
        this.bundle.include.concat(include);
      } else {
        include.forEach((relation) => {
          if (~this.allowedIncludes.indexOf(relation)) this.bundle.include.push(relation);
        });
      }
    }

    return this;
  }

  /** Parse allowed filters out of req.query and store them to this.bundle.filters */
  buildFilters() {
    this.bundle.filters = [];

    let filterName;
    for (let key of Object.keys(this.bundle.query)) {
      filterName = key.split('__')[0];
      if (this.allowedFilters === 'ALL') {
       if (!~reservedParams.indexOf(filterName) && this.fields !== 'ALL' && ~Object.keys(this.fields).indexOf(filterName)) this.bundle.filters.push(key);
       else if (!~reservedParams.indexOf(filterName) && this.fields === 'ALL') this.bundle.filters.push(key);
      } else {
        if (~this.allowedFilters.indexOf(filterName)) this.bundle.filters.push(key);
      }
    }

    return this;
  }

  /**
   * Express middleware handler for parsing the querystring and saving it back to this.query.
   */
  buildBundle(req, res, next) {
    let reservedParams = ['limit', 'offset', 'include', 'orderBy', 'orderDirection'].concat(this.customParams);

    this.bundle = {
      body: this.buildBody(req.body),
      query: Object.assign({}, req.query),
      req: req,
      res: res
    };

    this.buildFilters();
    this.buildInclude();
    this.buildWhere();
    this.buildOrderBy();

    next();
  }

  /** Internal middleware handler for a GET request to the resource list url. */
  _getList(req, res, next) {
    let collection = this.Model.collection();

    this.getList().then(() => {
      return collection.query((qb) => {
        this.bundle.where.forEach(whereClause => qb.whereRaw.apply(qb, whereClause));
      }).count();
    }).then((count) => {
      this.bundle.meta = {};
      this.bundle.meta.results = this.bundle.objects.length;
      this.bundle.meta.totalResults = parseInt(count);
      this.bundle.meta.limit = this.bundle.query.limit || this.limit;
      this.bundle.meta.offset = this.bundle.query.offset || this.offset;
    }).catch((err) => {
      console.log(err);
      next({ errorMessage: 'Error fetching resources.', statusCode: 500 });
    }).finally(next);
  }

  /** Builds the query for GET request to the resource list url and returns the Promise. */
  getList() {
    let collection = this.Model.collection();
    let fetchOpts = {};

    if (this.bundle.include.length) fetchOpts.withRelated = this.bundle.include;

    return collection.query((qb) => {
      this.bundle.where.forEach(whereClause => qb.whereRaw.apply(qb, whereClause));
      qb.orderBy.apply(qb, this.bundle.orderBy);
      qb.limit.call(qb, this.bundle.query.limit || this.limit);
      qb.offset.call(qb, this.bundle.query.offset || this.offset);
    }).fetch(fetchOpts).then((collection) => {
      this.bundle.objects = collection;
      return Promise.resolve(collection);
    });
  }

  /** Internal middleware handler for a GET request to the resource detail url. */
  _getDetail(req, res, next) {
    return this.getDetail(req.params[this.identifierField]).catch(this.Model.NotFoundError, (err) => {
      next({ errorMessage: 'Resource not found.', statusCode: 404 });
    }).catch((err) => {
      console.trace(err);
      next(err);
    }).finally(next);
  }

  /** Builds the query for GET request to the resource detail url and returns the Promise. */
  getDetail(identifier) {
    let model = this.Model.forge({
      [this.identifierField]: identifier
    });
    let fetchOpts = { require: true };

    if (this.bundle.include.length) fetchOpts.withRelated = this.bundle.include;

    return model.query((qb) => {
      this.bundle.where.forEach(whereClause => qb.whereRaw.apply(qb, whereClause));
    }).fetch(fetchOpts).then((model) => {
      this.bundle.objects = model;
      return Promise.resolve(model);
    });
  }

  /** Internal middleware handler for a PUT request to the resource detail url. */
  _put(req, res, next) {
    return this.put(req.params[this.identifierField]).catch(next).finally(next);
  }

  /** Builds the query for a PUT request to the resource detail url and returns a Promise. */
  put(identifier) {
    let model = this.Model.forge({
      [this.identifierField]: identifier
    });
    let fetchOpts = {};

    if (this.bundle.include.length) fetchOpts.withRelated = this.bundle.include;

    return model.query((qb) => {
      this.bundle.where.forEach(whereClause => qb.whereRaw.apply(qb, whereClause));
    }).fetch(fetchOpts).then((model) => {
      if (!model) return Promise.reject({ errorMessage: 'Resource not found.', statusCode: 404 });

      return Promise.resolve(model);
    }).then((model) => {
      return model.save(this.bundle.body);
    }).then((updated) => {
      this.bundle.objects = updated;
      return Promise.resolve(updated);
    });
  }

  /** Internal middleware handler for a POST request to the resource list url. */
  _post(req, res, next) {
    let isValid = this.validateRequiredFields(this.bundle.body);

    if (isValid !== true) return next(isValid);

    return this.post(this.bundle.body).catch((err) => {
      console.log(err);
      next({ errorMessage: 'Error creating resource.', statusCode: 400 });
    }).finally(next);
  }

  /** Builds the query for a POST request to the resource list url and returns a Promise. */
  post(attrs) {
    let model = this.Model.forge(attrs);
    let fetchOpts = {};

    if (this.bundle.include.length) fetchOpts.withRelated = this.bundle.include;

    return model.save().then((model) => {
      return this.Model.forge({ [this.identifierField]: model.get(this.identifierField) }).fetch(fetchOpts);
    }).then((model) => {
      this.bundle.objects = model;
      return Promise.resolve(model);
    });
  }

  /** Internal middleware handler for a DELETE request to the resource detail url. */
  _delete(req, res, next) {
    return this.delete(req.params[this.identifierField]).catch((err) => {
      if (err.errorMessage) return next(err);
      next({ errorMessage: 'Error deleting resource', statusCode: 400 });
    }).finally(next);
  }

  delete(identifier) {
    let model = this.Model.forge({
      [this.identifierField]: identifier
    });

    return model.query((qb) => {
      this.bundle.where.forEach(whereClause => qb.whereRaw.apply(qb, whereClause));
    }).fetch().then((model) => {
      if (!model) return Promise.reject({ errorMessage: 'Resource not found.', statusCode: 404 });
      this.bundle.deleted = model.toJSON();
      return Promise.resolve(model);
    }).then((model) => {
      return model.destroy({ require: true });
    });
  }

  /** Uses this.bundle to turn the resource in to JSON. */
  toJSON(objects, opts) {
    opts = Object.assign({
      pivotAttrs: false
    }, opts || {});
    let json = {};

    // when related resources have toJSON called, make sure they have a bundle object
    if (!this.bundle && opts.bundle) this.buildBundle(opts.bundle.req, opts.bundle.res, () => {});

    if (objects && utils.isFunction(objects.toJSON)) objects = objects.toJSON();

    if (this.fields === 'ALL') return objects;

    let cleanAttrs;
    /** Given a base level resource, clean it and all related objects. */
    cleanAttrs = (attrs) => {
      let cleaned = {};
      let fieldOpts;

      let cleanRelated;
      /** Cleans related fields that aren't resources */
      cleanRelated = (related, relatedOpts) => {
        if (relatedOpts.full) return related;
        if (utils.isString(relatedOpts.fields)) return related[relatedOpts.fields];
        if (Array.isArray(relatedOpts.fields)) {
          return relatedOpts.fields.reduce((relatedObj, relatedField) => {
            relatedObj[relatedField] = related[relatedField];
            return relatedObj;
          }, {});
        }
      };

      // clean fields
      if (Array.isArray(this.fields)) {
        this.fields.forEach((field) => {
          if (attrs.hasOwnProperty(field)) cleaned[field] = attrs[field];
        });
      } else {
        let resourceName;
        let resource;

        for (let field of Object.keys(this.fields)) {
          fieldOpts = this.fields[field];

          // if it's a related field and we fetched it (i.e. it's in attrs)
          if (fieldOpts.related && attrs.hasOwnProperty(field)) {
            resourceName = utils.isString(fieldOpts.related) ? fieldOpts.related : false;

            // if it's a related field with a resource string, check the API registry for the resource so we can run its toJSON method
            if (resourceName && this.api && this.api.registry.hasOwnProperty(resourceName)) {
              resource = this.api.registry[resourceName];

              // if it has a full flag, we simple run toJSON on the registered resource and let it do all the work
              if (fieldOpts.full) {
                cleaned[field] = resource.toJSON(attrs[field], {
                  bundle: this.bundle,
                  pivotAttrs: fieldOpts.pivotAttrs ? fieldOpts.pivotAttrs : false
                });
              } else {
                // otherwise, we just map back the resources idetifierField to the attribute
                cleaned[field] = attrs[field][resource.identifierField];
              }
            } else {
              // if it's not on the registry, run cleanRelated on the attr
              cleaned[field] = Array.isArray(attrs[field]) ? attrs[field].map((related) => { return cleanRelated(related, fieldOpts); }) : cleanRelated(attrs[field], fieldOpts);
            }
          } else {
            // it's not a related field and not hidden, put it on cleaned
            if (!fieldOpts.hidden && attrs.hasOwnProperty(field)) cleaned[field] = attrs[field];
          }
        }
      }

      // add pivot attrs
      if (opts.pivotAttrs) {
        opts.pivotAttrs.forEach((pivotAttr) => {
          if (attrs.hasOwnProperty('_pivot_' + pivotAttr)) cleaned[pivotAttr] = attrs['_pivot_' + pivotAttr];
        });
      }

      // add virtuals
      this.virtuals.forEach((virtual) => {
        if (utils.isFunction(this[virtual])) cleaned[virtual] = this[virtual].call(this, attrs);
      });

      return cleaned;
    };

    if (Array.isArray(objects)) json = objects.map(cleanAttrs);
    else if (objects) json = cleanAttrs(objects);

    return json;
  }

  /** Middleware to send the response. */
  createResponse(req, res, next) {
    let fallbackStatus = 200;

    if (req.method === 'POST') fallbackStatus = 202;
    if (req.method === 'DELETE') fallbackStatus = 204;

    let json = {};
    let cleaned = this.bundle.objects ? this.toJSON(this.bundle.objects) : {};

    if (Array.isArray(cleaned)) {
      json.objects = cleaned;
      json.meta = this.bundle.meta || {};
    } else {
      json = cleaned;
    }

    if (json) res.status(this.bundle.statusCode || fallbackStatus).json(json);
    else res.status(this.bundle.statusCode || fallbackStatus).send();
  }

  /** Middleware for error handling. */
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

module.exports = Resource;