'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var knex = require('knex');
var pathToRegexp = require('path-to-regexp');

var authentication = require('./authentication');
var authorization = require('./authorization');
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
      if (utils.isObject(this.allowedOrderBy) && ! ~this.allowedOrderBy.indexOf(this.identifierField)) this.allowedOrderBy.push(this.identifierField);
      if (this.customEndpoints.length) this.customEndpoints = this.customEndpoints.map(function (endpoint) {
        return _this2.parseCustomEndpoint(endpoint);
      });
      if (utils.isString(this.orderBy)) this.orderBy = [this.orderBy, 'DESC'];
      if (!utils.isString(this.fields) && !Array.isArray(this.fields)) {
        this.fields = Object.keys(this.fields).reduce(function (fields, field) {
          fields[field] = Object.assign({ hidden: false, readOnly: false, required: false, related: false, full: false, pivotAttrs: false }, _this2.fields[field]);
          return fields;
        }, {});
      }
      if (this.where.length && !Array.isArray(this.where[0])) this.where = [this.where];
    }

    /** Verifies that the request URL is a valid endpoint, otherwise respond with a 501. */

  }, {
    key: '_verifyEndpoint',
    value: function _verifyEndpoint(req, res, next) {
      var _this3 = this;

      var reqUrl = utils.removeTrailingSlashes(req.baseUrl);
      var reqMethod = req.method.toLowerCase();
      var isValid = false;
      var endpointRegExp = undefined;

      this.allowedEndpoints.forEach(function (endpoint) {
        endpointRegExp = pathToRegexp(_this3.getResourcePathForEndpoint(endpoint));
        if (endpointRegExp.test(reqUrl) && _this3.getMethodForEndpoint(endpoint) === reqMethod) isValid = true;
      });

      this.customEndpoints.forEach(function (endpoint) {
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

  }, {
    key: 'expose',
    value: function expose(app) {
      var _this4 = this;

      var catchAllResourceUrl = this.apiRoot + '/' + this.resourceName + '*';
      var beforeAll = utils.isFunction(this.beforeAll) ? this.beforeAll : function (req, res, next) {
        next();
      };
      var afterAll = utils.isFunction(this.afterAll) ? this.afterAll : function (req, res, next) {
        next();
      };
      var beforeHook = undefined;
      var afterHook = undefined;

      // Handle preflight OPTIONS request to resource
      // TODO: MAKE BETTER
      app.options(catchAllResourceUrl, function (req, res, next) {
        next();
      });

      // Create before/after hooks for allowedEndpoints
      this.allowedEndpoints.forEach(function (endpoint) {
        beforeHook = 'before' + utils.upperFirst(endpoint);
        afterHook = 'after' + utils.upperFirst(endpoint);
        if (!_this4[beforeHook]) _this4[beforeHook] = function (req, res, next) {
          next();
        };
        if (!_this4[afterHook]) _this4[afterHook] = function (req, res, next) {
          next();
        };
      });

      // Create before/after hooks for customEndpoints
      this.customEndpoints.forEach(function (endpoint) {
        if (!utils.isFunction(_this4[endpoint.handler])) throw new Error(_this4.constructor.name + ' is missing the handler method for ' + endpoint.path + '.');
        beforeHook = 'before' + utils.upperFirst(endpoint.handler);
        afterHook = 'after' + utils.upperFirst(endpoint.handler);
        if (!_this4[beforeHook]) _this4[beforeHook] = function (req, res, next) {
          next();
        };
        if (!_this4[afterHook]) _this4[afterHook] = function (req, res, next) {
          next();
        };
      });

      // Verify the current endpoint is valid.
      app.use(catchAllResourceUrl, this._verifyEndpoint.bind(this));

      // Build our `bundle` that can be used by other middleware to modify the resource query.
      app.use(catchAllResourceUrl, this.buildBundle.bind(this));

      // Bind allowedEndpoints
      this.allowedEndpoints.forEach(function (endpoint) {
        beforeHook = 'before' + utils.upperFirst(endpoint);
        afterHook = 'after' + utils.upperFirst(endpoint);

        app[_this4.getMethodForEndpoint(endpoint)](_this4.getResourcePathForEndpoint(endpoint), beforeAll.bind(_this4), _this4.authentication.authenticate.bind(_this4.authentication, endpoint, _this4), _this4.authorization.preAuthorize.bind(_this4.authorization, endpoint, _this4), _this4[beforeHook].bind(_this4), _this4['_' + endpoint].bind(_this4), _this4[afterHook].bind(_this4), _this4.authorization.authorize.bind(_this4.authorization, endpoint, _this4), afterAll.bind(_this4));
      });

      // Bind customEndpoints
      this.customEndpoints.forEach(function (endpoint) {
        beforeHook = 'before' + utils.upperFirst(endpoint.handler);
        afterHook = 'after' + utils.upperFirst(endpoint.handler);

        app[endpoint.method](endpoint.path, beforeAll.bind(_this4), endpoint.skipAuthentication ? function (req, res, next) {
          next();
        } : _this4.authentication.authenticate.bind(_this4.authentication, endpoint, _this4), endpoint.skipAuthorization ? function (req, res, next) {
          next();
        } : _this4.authorization.preAuthorize.bind(_this4.authorization, endpoint, _this4), _this4[beforeHook].bind(_this4), _this4[endpoint.handler].bind(_this4), _this4[afterHook].bind(_this4), endpoint.skipAuthorization ? function (req, res, next) {
          next();
        } : _this4.authorization.authorize.bind(_this4.authorization, endpoint, _this4), afterAll.bind(_this4));
      });

      // Bind final response
      app.use(catchAllResourceUrl, this.createResponse.bind(this));

      // Bind error handler
      if (this.api) app.use(catchAllResourceUrl, this.api.errorHandler.bind(this));else app.use(catchAllResourceUrl, this.errorHandler.bind(this));
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
      var handler = endpointParts.length > 2 && ! ~['skipAuthentication', 'skipAuthorization'].indexOf(endpointParts[2]) ? endpointParts[2] : endpointParts[1];

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
      var resourceUrl = undefined;

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
      var _this5 = this;

      if (this.fields === 'ALL' && !requiredFields) return true;

      requiredFields = requiredFields || Object.keys(this.fields).filter(function (field) {
        return _this5.fields[field].required;
      });

      var missingFields = [];
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = requiredFields[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var field = _step.value;

          if (! ~Object.keys(body).indexOf(field)) missingFields.push(field);
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
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = Object.keys(bodyCopy)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var fieldName = _step2.value;

            if (this.fields.hasOwnProperty(fieldName) && !this.fields[fieldName].readOnly) filtered[fieldName] = bodyCopy[fieldName];
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
      }

      return filtered;
    }

    /**
     * Builds an array of where filters to apply to the query
     * @return {Array}
     */

  }, {
    key: 'buildWhere',
    value: function buildWhere() {
      var _this6 = this;

      var query = this.bundle.query;
      var where = [];
      var filterType = undefined;
      var filterParts = undefined;
      var columnName = undefined;

      // loop over this.bundle.filters and build the where object
      this.bundle.filters.forEach(function (filter) {
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

      this.bundle.where = where;

      return this;
    }

    /**
     * Given the filtered query object, build orderBy and put it on this.bundle
     * @return {this}
     */

  }, {
    key: 'buildOrderBy',
    value: function buildOrderBy() {
      var _this7 = this;

      var query = this.bundle.query;
      var orderBy = this.orderBy;
      var validOrderOptions = [];
      var queryOrderOptions = undefined;

      if (query.orderBy) {
        queryOrderOptions = query.orderBy.split(',');

        if (utils.isString(this.allowedOrderBy) && this.allowedOrderBy === 'ALL') {
          validOrderOptions = queryOrderOptions;
        } else {
          queryOrderOptions.forEach(function (opt) {
            if (~_this7.allowedOrderBy.indexOf(opt)) validOrderOptions.push(opt);
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

  }, {
    key: 'buildInclude',
    value: function buildInclude() {
      var _this8 = this;

      var query = this.bundle.query;
      var include = query.include ? query.include.split(',') : [];

      this.bundle.include = [].concat(this.include);

      if (include.length > 0) {
        if (utils.isString(this.allowedIncludes) && this.allowedIncludes === 'ALL') {
          this.bundle.include.concat(include);
        } else {
          include.forEach(function (relation) {
            if (~_this8.allowedIncludes.indexOf(relation)) _this8.bundle.include.push(relation);
          });
        }
      }

      return this;
    }

    /** Parse allowed filters out of req.query and store them to this.bundle.filters */

  }, {
    key: 'buildFilters',
    value: function buildFilters() {
      this.bundle.filters = [];

      var filterName = undefined;
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = Object.keys(this.bundle.query)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var key = _step3.value;

          filterName = key.split('__')[0];
          if (this.allowedFilters === 'ALL') {
            if (! ~reservedParams.indexOf(filterName) && this.fields !== 'ALL' && ~Object.keys(this.fields).indexOf(filterName)) this.bundle.filters.push(key);else if (! ~reservedParams.indexOf(filterName) && this.fields === 'ALL') this.bundle.filters.push(key);
          } else {
            if (~this.allowedFilters.indexOf(filterName)) this.bundle.filters.push(key);
          }
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

      return this;
    }

    /**
     * Express middleware handler for parsing the querystring and saving it back to this.query.
     */

  }, {
    key: 'buildBundle',
    value: function buildBundle(req, res, next) {
      var reservedParams = ['limit', 'offset', 'include', 'orderBy', 'orderDirection'].concat(this.customParams);

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

  }, {
    key: '_getList',
    value: function _getList(req, res, next) {
      var _this9 = this;

      var collection = this.Model.collection();

      this.getList().then(function () {
        return collection.query(function (qb) {
          _this9.bundle.where.forEach(function (whereClause) {
            return qb.whereRaw.apply(qb, whereClause);
          });
        }).count();
      }).then(function (count) {
        _this9.bundle.meta = {};
        _this9.bundle.meta.results = _this9.bundle.objects.length;
        _this9.bundle.meta.total_results = parseInt(count);
        _this9.bundle.meta.limit = _this9.bundle.query.limit || _this9.limit;
        _this9.bundle.meta.offset = _this9.bundle.query.offset || _this9.offset;
      }).catch(function (err) {
        console.log(err);
        next({ errorMessage: 'Error fetching resources.', statusCode: 500 });
      }).finally(next);
    }

    /** Builds the query for GET request to the resource list url and returns the Promise. */

  }, {
    key: 'getList',
    value: function getList() {
      var _this10 = this;

      var collection = this.Model.collection();
      var fetchOpts = {};

      if (this.bundle.include.length) fetchOpts.withRelated = this.bundle.include;

      return collection.query(function (qb) {
        _this10.bundle.where.forEach(function (whereClause) {
          return qb.whereRaw.apply(qb, whereClause);
        });
        qb.orderBy.apply(qb, _this10.bundle.orderBy);
        qb.limit.call(qb, _this10.bundle.query.limit || _this10.limit);
        qb.offset.call(qb, _this10.bundle.query.offset || _this10.offset);
      }).fetch(fetchOpts).then(function (collection) {
        _this10.bundle.objects = collection;
        return Promise.resolve(collection);
      });
    }

    /** Internal middleware handler for a GET request to the resource detail url. */

  }, {
    key: '_getDetail',
    value: function _getDetail(req, res, next) {
      return this.getDetail(req.params[this.identifierField]).catch(this.Model.NotFoundError, function (err) {
        next({ errorMessage: 'Resource not found.', statusCode: 404 });
      }).catch(function (err) {
        console.trace(err);
        next(err);
      }).finally(next);
    }

    /** Builds the query for GET request to the resource detail url and returns the Promise. */

  }, {
    key: 'getDetail',
    value: function getDetail(identifier) {
      var _this11 = this;

      var model = this.Model.forge(_defineProperty({}, this.identifierField, identifier));
      var fetchOpts = { require: true };

      if (this.bundle.include.length) fetchOpts.withRelated = this.bundle.include;

      return model.query(function (qb) {
        _this11.bundle.where.forEach(function (whereClause) {
          return qb.whereRaw.apply(qb, whereClause);
        });
      }).fetch(fetchOpts).then(function (model) {
        _this11.bundle.objects = model;
        return Promise.resolve(model);
      });
    }

    /** Internal middleware handler for a PUT request to the resource detail url. */

  }, {
    key: '_put',
    value: function _put(req, res, next) {
      return this.put(req.params[this.identifierField]).catch(next).finally(next);
    }

    /** Builds the query for a PUT request to the resource detail url and returns a Promise. */

  }, {
    key: 'put',
    value: function put(identifier) {
      var _this12 = this;

      var model = this.Model.forge(_defineProperty({}, this.identifierField, identifier));
      var fetchOpts = {};

      if (this.bundle.include.length) fetchOpts.withRelated = this.bundle.include;

      return model.query(function (qb) {
        _this12.bundle.where.forEach(function (whereClause) {
          return qb.whereRaw.apply(qb, whereClause);
        });
      }).fetch(fetchOpts).then(function (model) {
        if (!model) return Promise.reject({ errorMessage: 'Resource not found.', statusCode: 404 });

        return Promise.resolve(model);
      }).then(function (model) {
        return model.save(_this12.bundle.body);
      }).then(function (updated) {
        _this12.bundle.objects = updated;
        return Promise.resolve(updated);
      });
    }

    /** Internal middleware handler for a POST request to the resource list url. */

  }, {
    key: '_post',
    value: function _post(req, res, next) {
      var isValid = this.validateRequiredFields(this.bundle.body);

      if (isValid !== true) return next(isValid);

      return this.post(this.bundle.body).catch(function (err) {
        console.log(err);
        next({ errorMessage: 'Error creating resource.', statusCode: 400 });
      }).finally(next);
    }

    /** Builds the query for a POST request to the resource list url and returns a Promise. */

  }, {
    key: 'post',
    value: function post(attrs) {
      var _this13 = this;

      var model = this.Model.forge(attrs);
      var fetchOpts = {};

      if (this.bundle.include.length) fetchOpts.withRelated = this.bundle.include;

      return model.save().then(function (model) {
        return _this13.Model.forge(_defineProperty({}, _this13.identifierField, model.get(_this13.identifierField))).fetch(fetchOpts);
      }).then(function (model) {
        _this13.bundle.objects = model;
        return Promise.resolve(model);
      });
    }

    /** Internal middleware handler for a DELETE request to the resource detail url. */

  }, {
    key: '_delete',
    value: function _delete(req, res, next) {
      return this.delete(req.params[this.identifierField]).catch(function (err) {
        if (err.errorMessage) return next(err);
        next({ errorMessage: 'Error deleting resource', statusCode: 400 });
      }).finally(next);
    }
  }, {
    key: 'delete',
    value: function _delete(identifier) {
      var _this14 = this;

      var model = this.Model.forge(_defineProperty({}, this.identifierField, identifier));

      return model.query(function (qb) {
        _this14.bundle.where.forEach(function (whereClause) {
          return qb.whereRaw.apply(qb, whereClause);
        });
      }).fetch().then(function (model) {
        if (!model) return Promise.reject({ errorMessage: 'Resource not found.', statusCode: 404 });
        return Promise.resolve(model);
      }).then(function (model) {
        return model.destroy({ require: true });
      });
    }

    /** Uses this.bundle to turn the resource in to JSON. */

  }, {
    key: 'toJSON',
    value: function toJSON(objects, opts) {
      var _this15 = this;

      opts = Object.assign({
        pivotAttrs: false
      }, opts || {});
      var json = {};

      if (objects && utils.isFunction(objects.toJSON)) objects = objects.toJSON();

      if (this.fields === 'ALL') return objects;

      var cleanAttrs = undefined;
      /** Given a base level resource, clean it and all related objects. */
      cleanAttrs = function cleanAttrs(attrs) {
        var cleaned = {};
        var fieldOpts = undefined;

        var cleanRelated = undefined;
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
        if (Array.isArray(_this15.fields)) {
          _this15.fields.forEach(function (field) {
            if (attrs.hasOwnProperty(field)) cleaned[field] = attrs[field];
          });
        } else {
          var resourceName = undefined;
          var resource = undefined;

          var _iteratorNormalCompletion4 = true;
          var _didIteratorError4 = false;
          var _iteratorError4 = undefined;

          try {
            for (var _iterator4 = Object.keys(_this15.fields)[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
              var field = _step4.value;

              fieldOpts = _this15.fields[field];

              // if it's a related field and we fetched it (i.e. it's in attrs)
              if (fieldOpts.related && attrs.hasOwnProperty(field)) {
                resourceName = utils.isString(fieldOpts.resource) ? fieldOpts.resource : false;

                // if it's a related field with a resource string, check the API registry for the resource so we can run its toJSON method
                if (resourceName && _this15.api && _this15.api.registry.hasOwnProperty(resourceName)) {
                  resource = _this15.api.registry[resourceName];

                  // if it has a full flag, we simple run toJSON on the registered resource and let it do all the work
                  if (fieldOpts.full) {
                    cleaned[field] = resource.toJSON(attrs[field], {
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
        _this15.virtuals.forEach(function (virtual) {
          if (utils.isFunction(_this15[virtual])) cleaned[virtual] = _this15[virtual].call(_this15, attrs);
        });

        return cleaned;
      };

      if (Array.isArray(objects)) json = objects.map(cleanAttrs);else if (objects) json = cleanAttrs(objects);

      return json;
    }

    /** Middleware to send the response. */

  }, {
    key: 'createResponse',
    value: function createResponse(req, res, next) {
      var fallbackStatus = 200;

      if (req.method === 'POST') fallbackStatus = 202;
      if (req.method === 'DELETE') fallbackStatus = 204;

      var json = {};
      var cleaned = this.bundle.objects ? this.toJSON(this.bundle.objects) : {};

      if (Array.isArray(cleaned)) {
        json.objects = cleaned;
        json.meta = this.bundle.meta || {};
      } else {
        json = cleaned;
      }

      if (json) res.status(this.bundle.statusCode || fallbackStatus).json(json);else res.status(this.bundle.statusCode || fallbackStatus).send();
    }

    /** Middleware for error handling. */

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
  }]);

  return Resource;
}();

module.exports = Resource;