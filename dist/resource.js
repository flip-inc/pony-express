'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var knex = require('knex');
var pathToRegexp = require('path-to-regexp');
var Promise = require('bluebird');

var authentication = require('./authentication');
var authorization = require('./authorization');
var Request = require('./request');
var utils = require('./utils');

/** Resource */

var Resource = function () {
  function Resource(opts) {
    _classCallCheck(this, Resource);

    this.opts = opts || {};

    // Initialize the resource, properties should be assigned here.
    this.initialize();

    // Parse
    this._verifyRequiredProps();
    this._parseOpts();
    this._parseProps();
    this._setDefaults();
  }

  _createClass(Resource, [{
    key: 'initialize',
    value: function initialize() {
      throw new Error(this.constructor.name + ' must implement `initialize()` to define properties.');
    }

    /**
     * Throws an error if a Resource is created without assigning the required properties.
     *
     * Required properties:
     *   `Model` - The Bookshelf Model classes to use for this resource.
     */

  }, {
    key: '_verifyRequiredProps',
    value: function _verifyRequiredProps() {
      if (!this.Model) throw new Error(this.constructor.name + ' must assign this.Model to be a Bookshelf.Model.');
    }

    /**
     * Parse this.opts and maps valid options back to this.
     */

  }, {
    key: '_parseOpts',
    value: function _parseOpts() {
      var _this = this;

      var validOptions = ['api', 'apiRoot'];

      validOptions.forEach(function (opt) {
        if (_this.opts[opt] && !_this[opt]) _this[opt] = _this.opts[opt];
      });
    }

    /**
     * Parses properties consistency.
     */

  }, {
    key: '_parseProps',
    value: function _parseProps() {
      // Convert 'get' option to 'getList' and 'getDetail' in this.allowedEndpoints
      if (this.allowedEndpoints && ~this.allowedEndpoints.indexOf('get')) {
        var getIndex = this.allowedEndpoints.indexOf('get');
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

  }, {
    key: '_setDefaults',
    value: function _setDefaults() {
      var _this2 = this;

      var defaultIdentifier = this.identifier || ':id';
      var normalizedIdentifier = defaultIdentifier.replace(/^:/g, '');

      // Defaults
      if (!this.allowedEndpoints) this.allowedEndpoints = ['getList', 'getDetail', 'post', 'put', 'delete'];
      if (!this.allowedFilters) this.allowedFilters = 'ALL';
      if (!this.allowedIncludes) this.allowedIncludes = 'ALL';
      if (!this.allowedOrderBy) this.allowedOrderBy = 'ALL';
      if (!this.apiRoot) this.apiRoot = '';
      if (!this.authentication) this.authentication = new authentication.BaseAuthentication();
      if (!this.authorization) this.authorization = new authorization.BaseAuthorization();
      if (!this.customEndpoints) this.customEndpoints = [];
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
      if (this.customEndpoints.length) this.customEndpoints = this.customEndpoints.map(function (endpoint) {
        return _this2.parseCustomEndpoint(endpoint);
      });
      if (!utils.isString(this.fields) && !Array.isArray(this.fields)) {
        this.fields = Object.keys(this.fields).reduce(function (fields, field) {
          fields[field] = Object.assign({ hidden: false, readOnly: false, required: false, related: false, full: false, pivotAttrs: false, virtual: false }, _this2.fields[field]);
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

  }, {
    key: 'expose',
    value: function expose(app) {
      var _this3 = this;

      var beforeHook = void 0;
      var afterHook = void 0;

      // Create beforeAll/afterAll hooks
      if (!utils.isFunction(this.beforeAll)) this.beforeAll = function (bundle) {
        return Promise.resolve();
      };
      if (!utils.isFunction(this.afterAll)) this.afterAll = function (bundle) {
        return Promise.resolve();
      };

      // Create before/after hooks for allowedEndpoints and bind endpoint middleware
      this.allowedEndpoints.forEach(function (endpoint) {
        beforeHook = 'before' + utils.upperFirst(endpoint);
        afterHook = 'after' + utils.upperFirst(endpoint);
        if (!_this3[beforeHook]) _this3[beforeHook] = function (bundle) {
          return Promise.resolve();
        };
        if (!_this3[afterHook]) _this3[afterHook] = function (bundle) {
          return Promise.resolve();
        };

        app[_this3.getMethodForEndpoint(endpoint)](_this3.getResourcePathForEndpoint(endpoint), function (req, res, next) {
          new Request(_this3, _this3.buildBundle(req, res, next));
        });
      });

      // Create before/after hooks for customEndpoints
      this.customEndpoints.forEach(function (endpoint) {
        if (!utils.isFunction(_this3[endpoint.handler])) throw new Error(_this3.constructor.name + ' is missing the handler method for ' + endpoint.path + '.');
        beforeHook = 'before' + utils.upperFirst(endpoint.handler);
        afterHook = 'after' + utils.upperFirst(endpoint.handler);
        if (!_this3[beforeHook]) _this3[beforeHook] = function (bundle) {
          return Promise.resolve();
        };
        if (!_this3[afterHook]) _this3[afterHook] = function (bundle) {
          return Promise.resolve();
        };

        app[endpoint.method](endpoint.path, function (req, res, next) {
          new Request(_this3, _this3.buildBundle(req, res, next));
        });
      });

      // Allow options requests through to be handled by Request
      var catchAllResourceUrl = this.apiRoot + '/' + this.resourceName + '*';
      app.options(catchAllResourceUrl, function (req, res, next) {
        new Request(_this3, _this3.buildBundle(req, res, next));
      });
    }

    /**
     * Filters req.body and returns only allowed options.
     * @param  {Object} request.body
     * @return {Object}
     */

  }, {
    key: 'buildBody',
    value: function buildBody(body) {
      var bodyCopy = Object.assign({}, body);
      var filtered = {};

      if (this.fields === 'ALL') return bodyCopy;

      if (Array.isArray(this.fields)) {
        this.fields.forEach(function (field) {
          if (bodyCopy.hasOwnProperty(field)) filtered[field] = bodyCopy[field];
        });
      } else {
        var field = void 0;
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = Object.keys(bodyCopy)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var fieldName = _step.value;

            field = this.fields[fieldName];
            if (!field || field.readOnly || field.virtual || field.related) continue;
            if (this.fields.hasOwnProperty(fieldName)) filtered[fieldName] = bodyCopy[fieldName];
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      }

      return filtered;
    }

    /** Parse allowed filters out of req.query and store them to this.filters */

  }, {
    key: 'buildFilters',
    value: function buildFilters(query) {
      var filters = [];
      var reservedParams = ['limit', 'include', 'offset', 'orderBy', 'orderDirection'];

      var filterName = void 0;
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = Object.keys(query)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var key = _step2.value;

          filterName = key.split('__')[0];
          if (this.allowedFilters === 'ALL') {
            if (!~reservedParams.indexOf(filterName) && this.fields !== 'ALL' && ~Object.keys(this.fields).indexOf(filterName)) filters.push(key);else if (!~reservedParams.indexOf(filterName) && this.fields === 'ALL') filters.push(key);
          } else {
            if (~this.allowedFilters.indexOf(filterName)) filters.push(key);
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      return filters;
    }
  }, {
    key: 'buildQuery',
    value: function buildQuery(query) {
      return Object.assign({}, query);
    }
  }, {
    key: 'buildInclude',
    value: function buildInclude(query) {
      var _this4 = this;

      var queryIncludes = query.include ? query.include.split(',') : [];
      var include = [].concat(this.include);

      if (queryIncludes.length > 0) {
        if (utils.isString(this.allowedIncludes) && this.allowedIncludes === 'ALL') {
          include = include.concat(queryIncludes);
        } else {
          queryIncludes.forEach(function (relation) {
            if (~_this4.allowedIncludes.indexOf(relation)) include.push(relation);
          });
        }
      }

      return include;
    }

    /**
     * Given the filtered query object, build orderBy and put it on this
     * @return {this}
     */

  }, {
    key: 'buildOrderBy',
    value: function buildOrderBy(query) {
      var _this5 = this;

      var orderDirection = query.orderDirection || this.orderDirection;
      var validOrderOptions = [];
      var queryOrderOptions = void 0;

      if (query.orderBy) {
        queryOrderOptions = query.orderBy.split(',');

        if (utils.isString(this.allowedOrderBy) && this.allowedOrderBy === 'ALL') {
          validOrderOptions = queryOrderOptions;
        } else {
          queryOrderOptions.forEach(function (opt) {
            if (~_this5.allowedOrderBy.indexOf(opt)) validOrderOptions.push(opt);
          });
        }
      }

      return validOrderOptions.length ? validOrderOptions.join(', ') + ' ' + orderDirection : this.orderBy + ' ' + orderDirection;
    }

    /**
     * Builds an array of where filters to apply to the query
     * @return {Array}
     */

  }, {
    key: 'buildWhere',
    value: function buildWhere(query) {
      var _this6 = this;

      var where = [];
      var filterType = void 0;
      var filterParts = void 0;
      var columnName = void 0;

      var filters = this.buildFilters(query);

      // loop over filters and build the where object
      filters.forEach(function (filter) {
        filterParts = filter.split('__');
        columnName = filterParts[0];
        filterType = filterParts.length > 1 ? filterParts[1] : 'equal';

        where.push(utils.buildWhereFilter(columnName, filterType, query[filter]));
      });

      // Add default where clauses from the resource
      this.where.forEach(function (whereClause) {
        if (utils.isFunction(whereClause)) return where.push(whereClause.call(_this6));
        where.push(whereClause);
      });

      return where;
    }
  }, {
    key: 'buildBundle',
    value: function buildBundle(req, res, next) {
      // Build our `bundle`
      var body = this.buildBody(req.body);
      var query = this.buildQuery(req.query);
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

  }, {
    key: 'parseCustomEndpoint',
    value: function parseCustomEndpoint(endpoint) {
      var endpointParts = endpoint.split(' ');
      var methodAndListOrDetail = endpointParts[0].split('#');
      var method = methodAndListOrDetail[0].toLowerCase();
      var listOrDetail = methodAndListOrDetail.length > 1 ? methodAndListOrDetail[1] : 'detail';
      var path = this['getFull' + utils.upperFirst(listOrDetail) + 'Endpoint'](endpointParts[1]);
      var handler = endpointParts.length > 2 && !~['skipAuthentication', 'skipAuthorization'].indexOf(endpointParts[2]) ? endpointParts[2] : endpointParts[1];

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

  }, {
    key: 'getFullListEndpoint',
    value: function getFullListEndpoint(endpointSegment) {
      return this.apiRoot + '/' + this.resourceName + '/' + utils.removeLeadingAndTrailingSlashes(endpointSegment);
    }

    /**
     * Given a partial endpoint string, returns a full endpoint string for this resource. 
     * @param  {String} endpointSegment
     * @return {String}
     */

  }, {
    key: 'getFullDetailEndpoint',
    value: function getFullDetailEndpoint(endpointSegment) {
      return this.apiRoot + '/' + this.resourceName + '/' + this.identifier + '/' + utils.removeLeadingAndTrailingSlashes(endpointSegment);
    }

    /**
     * Given a endpoint string, returns the full resource URL
     * @param  {String} endpoint
     * @return {String}
     */

  }, {
    key: 'getResourcePathForEndpoint',
    value: function getResourcePathForEndpoint(endpoint) {
      var resourceUrl = void 0;

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

  }, {
    key: 'getMethodForEndpoint',
    value: function getMethodForEndpoint(endpoint) {
      return endpoint === 'getList' || endpoint === 'getDetail' ? 'get' : endpoint;
    }

    /**
     * Iterates through this.fields, looks for required fields, and makes sure they're in body.
     * @param {Object} body The req.body fields to validate
     * @return {Boolean|Object} Returns true if valid or an error object if fields are missing
     */

  }, {
    key: 'validateRequiredFields',
    value: function validateRequiredFields(body, requiredFields) {
      var _this7 = this;

      if (this.fields === 'ALL' && !requiredFields) return true;

      requiredFields = requiredFields || Object.keys(this.fields).filter(function (field) {
        return _this7.fields[field].required;
      });

      var missingFields = [];
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = requiredFields[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var field = _step3.value;

          if (!~Object.keys(body).indexOf(field)) missingFields.push(field);
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
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

  }, {
    key: 'getList',
    value: function getList(bundle) {
      var _this8 = this;

      var collection = this.Model.collection();
      var fetchOpts = {};

      if (bundle.include.length) fetchOpts.withRelated = bundle.include;

      return collection.query(function (qb) {
        bundle.where.forEach(function (whereClause) {
          return qb.whereRaw.apply(qb, whereClause);
        });
        qb.orderByRaw.call(qb, bundle.orderBy);
        qb.limit.call(qb, bundle.query.limit || _this8.limit);
        qb.offset.call(qb, bundle.query.offset || _this8.offset);
      }).fetch(fetchOpts).then(function (collection) {
        bundle.objects = collection;
        return Promise.resolve(collection);
      }).then(function () {
        return collection.query(function (qb) {
          bundle.where.forEach(function (whereClause) {
            return qb.whereRaw.apply(qb, whereClause);
          });
        }).count();
      }).then(function (count) {
        bundle.meta = {};
        bundle.meta.results = bundle.objects.length;
        bundle.meta.totalResults = parseInt(count);
        bundle.meta.limit = parseInt(bundle.query.limit) || _this8.limit;
        bundle.meta.offset = parseInt(bundle.query.offset) || _this8.offset;
        return Promise.resolve(bundle.objects);
      }).catch(function (err) {
        console.trace(err);
        return Promise.reject({ errorMessage: 'Error fetching resources.', statusCode: 500 });
      });
    }

    /** Builds the query for GET request to the resource detail url and returns the Promise. */

  }, {
    key: 'getDetail',
    value: function getDetail(bundle) {
      var model = this.Model.forge(_defineProperty({}, this.identifierField, bundle.req.params[this.identifierField]));
      var fetchOpts = { require: true };

      if (bundle.include.length) fetchOpts.withRelated = bundle.include;

      return model.query(function (qb) {
        bundle.where.forEach(function (whereClause) {
          return qb.whereRaw.apply(qb, whereClause);
        });
      }).fetch(fetchOpts).then(function (model) {
        bundle.objects = model;
        return Promise.resolve(model);
      }).catch(this.Model.NotFoundError, function (err) {
        return Promise.reject({ errorMessage: 'Resource not found.', statusCode: 404 });
      }).catch(function (err) {
        console.trace(err);
        if (err.errorMessage) return Promise.reject(err);
        return Promise.reject({ errorMessage: 'Error fetching resource.', statusCode: 500 });
      });
    }

    /** Builds the query for a PUT request to the resource detail url and returns a Promise. */

  }, {
    key: 'put',
    value: function put(bundle) {
      var model = this.Model.forge(_defineProperty({}, this.identifierField, bundle.req.params[this.identifierField]));
      var fetchOpts = {};

      if (bundle.include.length) fetchOpts.withRelated = bundle.include;

      return model.query(function (qb) {
        bundle.where.forEach(function (whereClause) {
          return qb.whereRaw.apply(qb, whereClause);
        });
      }).fetch(fetchOpts).then(function (model) {
        if (!model) return Promise.reject({ errorMessage: 'Resource not found.', statusCode: 404 });
        return model.save(bundle.body);
      }).then(function (updated) {
        bundle.objects = updated;
        return Promise.resolve(updated);
      }).catch(function (err) {
        console.trace(err);
        if (err.errorMessage) return Promise.reject(err);
        return Promise.reject({ errorMessage: 'Error updating resource.', statusCode: 500 });
      });
    }

    /** Builds the query for a POST request to the resource list url and returns a Promise. */

  }, {
    key: 'post',
    value: function post(bundle) {
      var _this9 = this;

      var isValid = this.validateRequiredFields(bundle.body);

      if (isValid !== true) return Promise.reject(isValid);

      var model = this.Model.forge(bundle.body);
      var fetchOpts = {};

      if (bundle.include.length) fetchOpts.withRelated = bundle.include;

      return model.save().then(function (model) {
        return _this9.Model.forge(_defineProperty({}, _this9.identifierField, model.get(_this9.identifierField))).fetch(fetchOpts);
      }).then(function (model) {
        bundle.objects = model;
        return Promise.resolve(model);
      }).catch(function (err) {
        console.trace(err);
        if (err.errorMessage) return Promise.reject(err);
        return Promise.reject({ errorMessage: 'Error creating resource.', statusCode: 500 });
      });
    }
  }, {
    key: 'delete',
    value: function _delete(bundle) {
      var model = this.Model.forge(_defineProperty({}, this.identifierField, bundle.req.params[this.identifierField]));

      return model.query(function (qb) {
        bundle.where.forEach(function (whereClause) {
          return qb.whereRaw.apply(qb, whereClause);
        });
      }).fetch().then(function (model) {
        if (!model) return Promise.reject({ errorMessage: 'Resource not found.', statusCode: 404 });
        return Promise.resolve(model);
      }).then(function (model) {
        return model.destroy({ require: true });
      }).catch(function (err) {
        console.trace(err);
        if (err.errorMessage) return Promise.reject(err);
        Promise.reject({ errorMessage: 'Error deleting resource', statusCode: 500 });
      });
    }

    /** Uses this.bundle to turn the resource in to JSON. */

  }, {
    key: 'toJSON',
    value: function toJSON(objects, opts) {
      var _this10 = this;

      opts = Object.assign({
        pivotAttrs: false
      }, opts || {});
      var json = {};

      if (objects && utils.isFunction(objects.toJSON)) objects = objects.toJSON();

      if (this.fields === 'ALL') return objects;

      var cleanAttrs = void 0;
      /** Given a base level resource, clean it and all related objects. */
      cleanAttrs = function cleanAttrs(attrs) {
        var cleaned = {};
        var fieldOpts = void 0;

        var cleanRelated = void 0;
        /** Cleans related fields that aren't resources */
        cleanRelated = function cleanRelated(related, relatedOpts) {
          if (relatedOpts.full) return related;
          if (utils.isString(relatedOpts.fields)) return related[relatedOpts.fields];
          if (Array.isArray(relatedOpts.fields)) {
            return relatedOpts.fields.reduce(function (relatedObj, relatedField) {
              relatedObj[relatedField] = related[relatedField];
              return relatedObj;
            }, {});
          }
        };

        // clean fields
        if (Array.isArray(_this10.fields)) {
          _this10.fields.forEach(function (field) {
            if (attrs.hasOwnProperty(field)) cleaned[field] = attrs[field];
          });
        } else {
          var resourceName = void 0;
          var resource = void 0;

          var _iteratorNormalCompletion4 = true;
          var _didIteratorError4 = false;
          var _iteratorError4 = undefined;

          try {
            for (var _iterator4 = Object.keys(_this10.fields)[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
              var field = _step4.value;

              fieldOpts = _this10.fields[field];

              // if it's a related field and we fetched it (i.e. it's in attrs)
              if (fieldOpts.related && attrs.hasOwnProperty(field)) {
                resourceName = utils.isString(fieldOpts.related) ? fieldOpts.related : false;

                // if it's a related field with a resource string, check the API registry for the resource so we can run its toJSON method
                if (resourceName && _this10.api && _this10.api.registry.hasOwnProperty(resourceName)) {
                  resource = _this10.api.registry[resourceName];

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
                  cleaned[field] = Array.isArray(attrs[field]) ? attrs[field].map(function (related) {
                    return cleanRelated(related, fieldOpts);
                  }) : cleanRelated(attrs[field], fieldOpts);
                }
              } else {
                // it's not a related field and not hidden, put it on cleaned
                if (!fieldOpts.hidden && attrs.hasOwnProperty(field)) cleaned[field] = attrs[field];
              }
            }
          } catch (err) {
            _didIteratorError4 = true;
            _iteratorError4 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion4 && _iterator4.return) {
                _iterator4.return();
              }
            } finally {
              if (_didIteratorError4) {
                throw _iteratorError4;
              }
            }
          }
        }

        // add pivot attrs
        if (opts.pivotAttrs) {
          opts.pivotAttrs.forEach(function (pivotAttr) {
            if (attrs.hasOwnProperty('_pivot_' + pivotAttr)) cleaned[pivotAttr] = attrs['_pivot_' + pivotAttr];
          });
        }

        // add virtuals
        _this10.virtuals.forEach(function (virtual) {
          if (utils.isFunction(_this10[virtual])) cleaned[virtual] = _this10[virtual].call(_this10, attrs, opts.bundle);
        });

        return cleaned;
      };

      if (Array.isArray(objects)) json = objects.map(cleanAttrs);else if (objects) json = cleanAttrs(objects);

      return json;
    }

    /** Middleware for error handling. */

  }, {
    key: 'errorHandler',
    value: function errorHandler(err, req, res, next) {
      if (this.api) return this.api.errorHandler.call(this, err, req, res, next);

      var json = {};

      Object.assign(json, {
        statusCode: err.statusCode || 500,
        message: err.errorMessage || 'Sorry, we ran in to an error while processing your request. If this problem persists, please contact support.'
      });

      if (err.hasOwnProperty('errorCode')) json.errorCode = err.errorCode;

      res.status(json.statusCode).json(json);
    }
  }]);

  return Resource;
}();

module.exports = Resource;