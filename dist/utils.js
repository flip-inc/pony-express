'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var uuid = require('uuid');

function isObject(thing) {
  return (typeof thing === 'undefined' ? 'undefined' : _typeof(thing)) === 'object';
}

function isString(thing) {
  return typeof thing === 'string';
}

function isFunction(thing) {
  return typeof thing === 'function';
}

function removeLeadingSlashes(string) {
  return string.replace(/^\/*/g, '');
}

function removeTrailingSlashes(string) {
  return string.replace(/\/*$/g, '');
}

function removeLeadingAndTrailingSlashes(string) {
  return removeTrailingSlashes(removeLeadingSlashes(string));
}

/**
 * Builds a where filter formatted for passing in to knex.whereRaw
 * @param  {String} columnName
 * @param  {String} filterType - The filterStype string
 * @param  {String|Object} filter - The value to filter on
 *
 * Valid where filter examples:
 *   Direct match -> ?uuid=1
 *   whereIn -> ?uuid__in=1,2,3,4,5
 *   greater than or equal to -> ?created_at__gte=[DATE]
 *   less than or equal to -> ?created_at__lte=[DATE]
 *   greater than -> ?created_at__gt=[DATE]
 *   less than -> ?created_at__lt=[DATE]
 *   case sensitive starts with -> ?name__startswith=[STRING]
 *   case sensitive ends with -> ?name__endswith=[STRING]
 *   case sensitive contains -> ?name__contains=[STRING]
 *   case insensitive starts with -> ?name__istartswith=[STRING]
 *   case insensitive ends with -> ?name__iendswith=[STRING]
 *   case insensitive contains -> ?name__icontains=[STRING]
 * 
 * @return {Object}            Array to pass directly to knex.whereRaw as "arguments".
 */
function buildWhereFilter(columnName, filterType, filter) {
  var whereFilter = void 0;

  switch (filterType) {
    case 'equals':
    case 'equal':
    case '=':
    case 'eq':
      whereFilter = ['' + columnName + ' = ?', filter];
      break;
    case 'ne':
      whereFilter = ['' + columnName + ' <> ?', filter];
      break;
    case 'in':
      if (isString(filter)) filter = filter.split(',');
      whereFilter = ['' + columnName + ' IN (' + filter.map(function (f) {
        return "?";
      }).join(', ') + ')', filter];
      break;
    case 'iin':
      if (isString(filter)) filter = filter.split(',');
      whereFilter = ['LOWER(' + columnName + ') IN (' + filter.map(function (f) {
        return "?";
      }).join(', ') + ')', filter.map(function (f) {
        return f.toLowerCase();
      })];
      break;
    case 'gte':
      whereFilter = ['' + columnName + ' >= ?', filter];
      break;
    case 'gt':
      whereFilter = ['' + columnName + ' > ?', filter];
      break;
    case 'lte':
      whereFilter = ['' + columnName + ' <= ?', filter];
      break;
    case 'lt':
      whereFilter = ['' + columnName + ' < ?', filter];
      break;
    case 'startswith':
      whereFilter = ['' + columnName + ' LIKE ?', filter + '%'];
      break;
    case 'endswith':
      whereFilter = ['' + columnName + ' LIKE ?', '%' + filter];
      break;
    case 'contains':
      whereFilter = ['' + columnName + ' LIKE ?', '%' + filter + '%'];
      break;
    case 'istartswith':
      whereFilter = ['LOWER(' + columnName + ') LIKE ?', filter.toLowerCase() + '%'];
      break;
    case 'iendswith':
      whereFilter = ['LOWER(' + columnName + ') LIKE ?', '%' + filter.toLowerCase()];
      break;
    case 'icontains':
      whereFilter = ['LOWER(' + columnName + ') LIKE ?', '%' + filter.toLowerCase() + '%'];
      break;
  }

  return whereFilter;
}

/**
 * Given a string, capitalize the first letter and return the new string.
 * @param  {String} str - The string to alter.
 * @return {String}     The altered string.
 */
function upperFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
  buildWhereFilter: buildWhereFilter,
  isFunction: isFunction,
  isObject: isObject,
  isString: isString,
  removeLeadingSlashes: removeLeadingSlashes,
  removeTrailingSlashes: removeTrailingSlashes,
  removeLeadingAndTrailingSlashes: removeLeadingAndTrailingSlashes,
  upperFirst: upperFirst
};