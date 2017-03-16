'use strict';

const knex = require('knex');
const pathToRegexp = require('path-to-regexp');
const Promise = require('bluebird');

const authentication = require('./authentication');
const authorization = require('./authorization');
const Request = require('./request');
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
    if (!this.orderBy) this.orderBy = this.identifierField;
    if (!this.orderDirection) this.orderDirection = 'DESC';
    if (!this.resourceName) this.resourceName = this.Model.prototype.tableName;
    if (!this.virtuals) this.virtuals = [];
    if (!this.where) this.where = [];

    // Advanced defaults
    if (utils.isObject(this.allowedOrderBy) && !~this.allowedOrderBy.indexOf(this.identifierField)) this.allowedOrderBy.push(this.identifierField);
    if (this.customEndpoints.length) this.customEndpoints = this.customEndpoints.map((endpoint => this.parseCustomEndpoint(endpoint)));
    if (!utils.isString(this.fields) && !Array.isArray(this.fields)) {
      this.fields = Object.keys(this.fields).reduce((fields, field) => {
        fields[field] = Object.assign({ hidden: false, readOnly: false, required: false, related: false, full: false, pivotAttrs: false, virtual: false }, this.fields[field]);
        return fields;
      }, {});
    }
    if (this.where.length && !Array.isArray(this.where[0])) this.where = [this.where];
  }

  /**
   * Exposes resource endpoints on the app and installs appropriate middleware.
   * @param  {Object} app - Express app.
   * @return {this}
   */
  expose(app) {
    let beforeHook;
    let afterHook;

    // Create beforeAll/afterAll hooks
    if (!utils.isFunction(this.beforeAll)) this.beforeAll = (bundle) => { return Promise.resolve(); };
    if (!utils.isFunction(this.afterAll)) this.afterAll = (bundle) => { return Promise.resolve(); };

    // Create before/after hooks for allowedEndpoints and bind endpoint middleware
    this.allowedEndpoints.forEach((endpoint) => {
      beforeHook = 'before' + utils.upperFirst(endpoint);
      afterHook = 'after' + utils.upperFirst(endpoint);
      if (!this[beforeHook]) this[beforeHook] = (bundle) => { return Promise.resolve(); };
      if (!this[afterHook]) this[afterHook] = (bundle) => { return Promise.resolve(); };

      app[this.getMethodForEndpoint(endpoint)](
        this.getResourcePathForEndpoint(endpoint),
        (req, res, next) => { new Request(this, this.buildBundle(req, res, next)); }
      );
    });

    // Create before/after hooks for customEndpoints
    this.customEndpoints.forEach((endpoint) => {
      if (!utils.isFunction(this[endpoint.handler])) throw new Error(this.constructor.name + ' is missing the handler method for ' + endpoint.path + '.');
      beforeHook = 'before' + utils.upperFirst(endpoint.handler);
      afterHook = 'after' + utils.upperFirst(endpoint.handler);
      if (!this[beforeHook]) this[beforeHook] = (bundle) => { return Promise.resolve(); };
      if (!this[afterHook]) this[afterHook] = (bundle) => { return Promise.resolve(); };

      app[endpoint.method](
        endpoint.path,
        (req, res, next) => { new Request(this, this.buildBundle(req, res, next)); }
      );
    });

    // Allow options requests through to be handled by Request
    const catchAllResourceUrl = this.apiRoot + '/' + this.resourceName + '*';
    app.options(catchAllResourceUrl, (req, res, next) => { new Request(this, this.buildBundle(req, res, next)); });
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

  /** Parse allowed filters out of req.query and store them to this.filters */
  buildFilters(query) {
    let filters = [];
    let reservedParams = [
      'limit',
      'include',
      'offset',
      'orderBy',
      'orderDirection',
    ];

    let filterName;
    for (let key of Object.keys(query)) {
      filterName = key.split('__')[0];
      if (this.allowedFilters === 'ALL') {
       if (!~reservedParams.indexOf(filterName) && this.fields !== 'ALL' && ~Object.keys(this.fields).indexOf(filterName)) filters.push(key);
       else if (!~reservedParams.indexOf(filterName) && this.fields === 'ALL') filters.push(key);
      } else {
        if (~this.allowedFilters.indexOf(filterName)) filters.push(key);
      }
    }

    return filters;
  }

  buildQuery(query) {
    return Object.assign({}, query);
  }

  buildInclude(query) {
    let queryIncludes = query.include ? query.include.split(',') : [];
    let include = [].concat(this.include);

    if (queryIncludes.length > 0) {
      if (utils.isString(this.allowedIncludes) && this.allowedIncludes === 'ALL') {
        include = include.concat(queryIncludes);
      } else {
        queryIncludes.forEach((relation) => {
          if (~this.allowedIncludes.indexOf(relation)) include.push(relation);
        });
      }
    }

    return include;
  }

  /**
   * Given the filtered query object, build orderBy and put it on this
   * @return {this}
   */
  buildOrderBy(query) {
    let orderDirection = query.orderDirection || this.orderDirection;
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
    }

    return validOrderOptions.length ? validOrderOptions.join(', ') + ' ' + orderDirection : this.orderBy + ' ' + orderDirection;
  }

  /**
   * Builds an array of where filters to apply to the query
   * @return {Array}
   */
  buildWhere(query) {
    let where = [];
    let filterType;
    let filterParts;
    let columnName;

    let filters = this.buildFilters(query);

    // loop over filters and build the where object
    filters.forEach((filter) => {
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

    return where;
  }

  buildBundle(req, res, next) {
    // Build our `bundle`
    let body = this.buildBody(req.body);
    let query = this.buildQuery(req.query);
    return {
      body: body,
      filters: this.buildFilters(query),
      include: this.buildInclude(query),
      orderBy: this.buildOrderBy(query),
      query: query,
      where: this.buildWhere(query),
      req: req,
      res: res,
      next: next,
      resource: this
    };
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

  /** Builds the query for GET request to the resource list url and returns the Promise. */
  getList(bundle) {
    let collection = this.Model.collection();
    let fetchOpts = {};

    if (bundle.include.length) fetchOpts.withRelated = bundle.include;

    return collection.query((qb) => {
      bundle.where.forEach(whereClause => qb.whereRaw.apply(qb, whereClause));
      qb.orderByRaw.call(qb, bundle.orderBy);
      qb.limit.call(qb, bundle.query.limit || this.limit);
      qb.offset.call(qb, bundle.query.offset || this.offset);
    }).fetch(fetchOpts).then((collection) => {
      bundle.objects = collection;
      return Promise.resolve(collection);
    }).then(() => {
      return collection.query((qb) => {
        bundle.where.forEach(whereClause => qb.whereRaw.apply(qb, whereClause));
      }).count();
    }).then((count) => {
      bundle.meta = {};
      bundle.meta.results = bundle.objects.length;
      bundle.meta.totalResults = parseInt(count);
      bundle.meta.limit = parseInt(bundle.query.limit) || this.limit;
      bundle.meta.offset = parseInt(bundle.query.offset) || this.offset;
      return Promise.resolve(bundle.objects);
    }).catch((err) => {
      console.trace(err);
      return Promise.reject({ errorMessage: 'Error fetching resources.', statusCode: 500 });
    });
  }

  /** Builds the query for GET request to the resource detail url and returns the Promise. */
  getDetail(bundle) {
    let model = this.Model.forge({
      [this.identifierField]: bundle.req.params[this.identifierField]
    });
    let fetchOpts = { require: true };

    if (bundle.include.length) fetchOpts.withRelated = bundle.include;

    return model.query((qb) => {
      bundle.where.forEach(whereClause => qb.whereRaw.apply(qb, whereClause));
    }).fetch(fetchOpts).then((model) => {
      bundle.objects = model;
      return Promise.resolve(model);
    }).catch(this.Model.NotFoundError, (err) => {
      return Promise.reject({ errorMessage: 'Resource not found.', statusCode: 404 });
    }).catch((err) => {
      console.trace(err);
      if (err.errorMessage) return Promise.reject(err);
      return Promise.reject({ errorMessage: 'Error fetching resource.', statusCode: 500 });
    });
  }

  /** Builds the query for a PUT request to the resource detail url and returns a Promise. */
  put(bundle) {
    let model = this.Model.forge({
      [this.identifierField]: bundle.req.params[this.identifierField]
    });
    let fetchOpts = {};

    if (bundle.include.length) fetchOpts.withRelated = bundle.include;

    return model.query((qb) => {
      bundle.where.forEach(whereClause => qb.whereRaw.apply(qb, whereClause));
    }).fetch(fetchOpts).then((model) => {
      if (!model) return Promise.reject({ errorMessage: 'Resource not found.', statusCode: 404 });
      return model.save(bundle.body);
    }).then((updated) => {
      bundle.objects = updated;
      return Promise.resolve(updated);
    }).catch((err) => {
      console.trace(err);
      if (err.errorMessage) return Promise.reject(err);
      return Promise.reject({ errorMessage: 'Error updating resource.', statusCode: 500 });
    });
  }

  /** Builds the query for a POST request to the resource list url and returns a Promise. */
  post(bundle) {
    let isValid = this.validateRequiredFields(bundle.body);

    if (isValid !== true) return Promise.reject(isValid);

    let model = this.Model.forge(bundle.body);
    let fetchOpts = {};

    if (bundle.include.length) fetchOpts.withRelated = bundle.include;

    return model.save().then((model) => {
      return this.Model.forge({ [this.identifierField]: model.get(this.identifierField) }).fetch(fetchOpts);
    }).then((model) => {
      bundle.objects = model;
      return Promise.resolve(model);
    }).catch((err) => {
      console.trace(err);
      if (err.errorMessage) return Promise.reject(err);
      return Promise.reject({ errorMessage: 'Error creating resource.', statusCode: 500 });
    });
  }

  delete(bundle) {
    let model = this.Model.forge({
      [this.identifierField]: bundle.req.params[this.identifierField]
    });

    return model.query((qb) => {
      bundle.where.forEach(whereClause => qb.whereRaw.apply(qb, whereClause));
    }).fetch().then((model) => {
      if (!model) return Promise.reject({ errorMessage: 'Resource not found.', statusCode: 404 });
      return Promise.resolve(model);
    }).then((model) => {
      return model.destroy({ require: true });
    }).catch((err) => {
      console.trace(err);
      if (err.errorMessage) return Promise.reject(err);
      Promise.reject({ errorMessage: 'Error deleting resource', statusCode: 500 });
    });
  }

  /** Uses this.bundle to turn the resource in to JSON. */
  toJSON(objects, opts) {
    opts = Object.assign({
      pivotAttrs: false
    }, opts || {});
    let json = {};

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
                  bundle: opts.bundle,
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
        if (utils.isFunction(this[virtual])) cleaned[virtual] = this[virtual].call(this, attrs, opts.bundle);
      });

      return cleaned;
    };

    if (Array.isArray(objects)) json = objects.map(cleanAttrs);
    else if (objects) json = cleanAttrs(objects);

    return json;
  }

  /** Middleware for error handling. */
  errorHandler(err, req, res, next) {
    if (this.api) return this.api.errorHandler.call(this, err, req, res, next);

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