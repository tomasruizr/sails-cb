'use strict';
/**
 * descriprion
 *
 * @module n1ql
 * @main n1ql
 */
//*******************************************
//Dependencies
//*******************************************
var _ = require('lodash');
var N1qlQuery = require('couchbase').N1qlQuery;
var moment = require('moment');
//*******************************************
// Constructor & Properties
//*******************************************

/**
 * [n1ql description]
 *
 * @class n1ql
 * 
 * @constructor
 */
var n1ql = function () {};

//*******************************************
//Methods
//*******************************************

n1ql.prototype.query = function (query, consistency) {
  return N1qlQuery.fromString(query).consistency(consistency || 1);
};

n1ql.prototype.buildSelect = function (collection, colDef, bucket, options) {
  var self = this;
  var query = 'SELECT ';
  var fields = [];
  if (options.groupBy && _.keys(_.pick(options, 'array_agg', 'average', 'count', 'max', 'min', 'sum')).length === 0){
    return {error:'You have to use an aggregate function if using groupBy clause'};
  }
  if (options.select){
    fields = options.select;
    fields.push('META(' + collection + ').id');
  } else {
    fields = ['*', 'META(' + collection + ').id'];
  }
  if (options.array_agg){
    _.each(options.array_agg, function(array_agg) {
      fields.push('array_agg(' + array_agg + ') ' + array_agg);
    });
  }
  if (options.average){
    _.each(options.average, function(avg) {
      fields.push('avg(' + avg + ') ' + avg);
    });
  }
  if (options.count){
    _.each(options.count, function(count) {
      fields.push('count(' + count + ') ' + count);
    });
  }
  if (options.max){
    _.each(options.max, function(max) {
      fields.push('max(' + max + ') ' + max);
    });
  }
  if (options.min){
    _.each(options.min, function(min) {
      fields.push('min(' + min + ') ' + min);
    });
  }
  if (options.sum){
    _.each(options.sum, function(sum) {
      fields.push('sum(' + sum + ') ' + sum);
    });
  }

  query += fields.join(', ');
  query += ' FROM ' + bucket + ' ' + collection;
  query += this.where(options.where, collection, bucket, colDef, options);
  if (options && options.groupBy) {
    query += ' GROUP BY ';
    // Normalize to array
    if (!Array.isArray(options.groupBy)) {
      options.groupBy = [options.groupBy];
    }
    options.groupBy = _.map(options.groupBy, function(g) {
      return self.scape(g);
    });
    query += options.groupBy.join(', ') + ' ';
  }
  
  ///////////////////////////////////////////////////
  // Added to pass the waterline integration tests //
  ///////////////////////////////////////////////////
  if (options.testMode && !options.sort){
    query += ' ORDER BY META('+ collection +').id ASC';
  }

  // Sort
  if (options && options.sort) {
    query += ' ORDER BY ';
    // Sort through each sort attribute criteria
    _.each(options.sort, function (direction, attrName) {
      query += collection + '.' + self.scape(attrName) + ' ';

      // Basic MongoDB-style numeric sort direction
      if (direction === 1) {
        query += 'ASC, ';
      } else {
        query += 'DESC, ';
      }
    });

    // Remove trailing comma
    if (query.slice(-2) === ', ') {
      query = query.slice(0, -2) + ' ';
    }
  }

  if (_.has(options, 'limit') && (options.limit !== null && options.limit !== undefined)) {
    query += ' LIMIT ' + options.limit + ' ';
  }

  if (_.has(options, 'skip') && (options.skip !== null && options.skip !== undefined)) {
    query += ' OFFSET ' + options.skip + ' ';
  }
  debug(query);
  return query;
};

n1ql.prototype.buildDelete = function (collection, colDef, bucket, options) {
  var query = 'DELETE FROM ' + bucket + ' ' + collection + this.where(options.where, collection, bucket, colDef, options);
  if (!options.doNotReturn){
    query += ' RETURNING ' + collection + ', META(' + collection + ').id';
  }
  return query;
};

n1ql.prototype.buildUpdate = function (collection, colDef, bucket, options, values) {
  var self = this;
  var set = '';
  if (values){
    set = ' SET ';
    var vals = [];
    _.forIn(values, function(value, key) {
      vals.push(key + ' = ' + self.prepareValue(value));
    });
    set += vals.join(', ');
  }
  var query = 'UPDATE ' + bucket + ' ' + collection + set + this.where(options.where, collection, bucket, colDef, options);
  if (!options.doNotReturn){
    query += ' RETURNING ' + collection + ', META(' + collection + ').id';
  }
  return query;
};

n1ql.prototype.wherePredicate = function(where, col, colDef, options){
  var self = this;
  var w = [];
  _.forIn(where, function (value, attr) {
    if (attr === 'or'){
      var or = [];
      var o;
      _.each(value, function(item) {
        o = self.wherePredicate(item, col, colDef, options);
        if (Array.isArray(o)){
          or.push('(' + o.join(' AND ') + ')');
        } else{
          or.push(o);
        }
      });
      w.push('(' + or.join(' OR ') + ')');
    } else if (_.isArray(value)){
      w.push(self.prepareWhereValue('IN', col, value, attr, colDef, options));
    } else if (typeof value === 'object') {
      // findLike workaround
      if (attr === 'like'){
        w.push(self.prepareWhereValue('like', col, _.values(value)[0], _.keys(value)[0], colDef, options));
      } else {  
        _.forIn(value, function (val, key) { //key = condition
          w.push(self.prepareWhereValue(key, col, val, attr, colDef, options));
        });
      }
    } else {
      w.push(self.prepareWhereValue('=', col, value, attr, colDef, options));
    }
  });
  return w;
};

n1ql.prototype.where = function (where, col, bucket, colDef, options) {
  if (!bucket) {
    bucket = col;
  }
  var w = this.wherePredicate(where, col, colDef, options);
  if (col && bucket) {
    w.push('META(' + col + ').id LIKE "' + col + '::%"');
  }
  return ' WHERE ' + w.join(' AND ');
};

n1ql.prototype.prepareWhereValue = function (key, col, value, attrStr, colDef, options) {
  var rawValue = value;
  debug('ATTRSTR',attrStr);
  debug('VALUE',value);
  value = this.prepareValue(value, attrStr, colDef, options);
  attrStr = this.prepareAttrs(col, attrStr, colDef, options);
  if (key === '<' || key === 'lessThan') {
    return attrStr + '<' + value;
  } else if (key === '<=' || key === 'lessThanOrEqual') {
    return attrStr + '<=' + value;
  } else if (key === '>' || key === 'greaterThan') {
    return attrStr + '>' + value;
  } else if (key === '>=' || key === 'greaterThanOrEqual') {
    return attrStr + '>=' + value;
  } else if (key === '!' || key === 'not') {
    if (rawValue === null) {
      return attrStr + ' IS NOT NULL';
    } else if (_.isArray(rawValue)) {
      return '(' + attrStr + ' NOT IN [' + value + '])';
    } else if (typeof rawValue === 'string') {
      if (rawValue.toUpperCase() === 'MISSING') {
        return attrStr + ' IS NOT MISSING';
      }
    }
    return attrStr + '<>' + value;
  } else if (key === 'like') {
    return attrStr + ' LIKE ' + value;
  } else if (key === 'contains') {
    return attrStr + ' LIKE "%' + value.replace(/"/g, '') + '%"';
  } else if (key === 'startsWith') {
    return attrStr + ' LIKE "' + value.replace(/"/g, '') + '%"';
  } else if (key === 'endsWith') {
    return attrStr + ' LIKE "%' + value.replace(/"/g, '') + '"';
  } else if (key === '=') {
    if (value === null){
      return attrStr + ' IS NULL';
    }
    else if (isNaN(rawValue) && rawValue.toUpperCase() === 'MISSING'){
      return attrStr + ' IS MISSING';
    }
    return attrStr + ' = ' + value;
  }
  else if (key === 'IN'){
    return '(' + attrStr + ' IN [' + value + '])';
  } else {
    throw new Error('Unknown comparator: ' + key);
  }
};

n1ql.prototype.prepareAttrs = function(col, attr, colDef, options) {
  if (colDef.primaryKey === attr){
    return 'META('+col+').id';
  }
  if (colDef.definition[attr].type === 'string' && !options.caseSensitive) {
    return 'lower('+ col + '.' + this.scape(attr) +')';
  }
  if (colDef.definition[attr].type === 'date') {
    return 'MILLIS('+ col + '.' + this.scape(attr) +')';
  }
  return col + '.' + this.scape(attr);
};

n1ql.prototype.prepareValue = function (value, attr, colDef, options) {
  function prepare(val) {

    if (_.isFunction(val)) {
      return val.toString();
    }
    if (_.isArray(val)){
      return _.map(val, function(item) {
        return prepare(item);
      }).toString();
    }
    // DATES
    if (colDef && colDef.definition && colDef.definition[attr] ){
      if (colDef.definition[attr].type === 'date') {
        return 'MILLIS("' + moment(new Date(val)).format() + '")';
      }
      if (colDef.definition[attr].type === 'string') {
        if (!options.caseSensitive && isNaN(val) && attr !== colDef.primaryKey){
          val = val.toLowerCase();
        }
        return '"' + val + '"';
      }
    }
    if (_.isDate(val)){
      return '"' + moment(new Date(val)).format() + '"';
    }
    if (isNaN(val)){
      return '"' + val + '"';
    }
    return val;
  }
  return prepare(value);
};

n1ql.prototype.toStringDate = function (date) {
  date = new Date(date);
  date = date.getFullYear() + '-' +
    ('00' + (date.getMonth() + 1)).slice(-2) + '-' +
    ('00' + date.getDate()).slice(-2) + ' ' +
    ('00' + date.getHours()).slice(-2) + ':' +
    ('00' + date.getMinutes()).slice(-2) + ':' +
    ('00' + date.getSeconds()).slice(-2);

  return '"' + date + '"';
};
n1ql.prototype.scape = function(str){ 
  return '`' + str + '`';
};
n1ql.prototype.normalizeResponse = function (value, collection, options) {
  if (options && options.select){
    return value;
  }
  function normalize(value, collection) { // also brings key
    //validate undefined Values
    if (value === undefined || value === null) {
      return undefined;
    }
    //recursive search of types.
    if (((collection && value[collection]) || Object.keys(value).length === 2) && value.id ) {      
      _.forIn(value, function( v, prop) {
        if (prop !== collection){
          value[collection][prop] = v; 
        }
      });
      value = value[collection];
    }
    if (value && value.constructor === Array) {
      return _.map(value, function(val) {
        return normalize(val, collection);
      });
    }
    if (typeof value === 'object') {
      return _.mapValues(value, function(val) {
        return normalize(val, collection);
      });
    }

    //////////////////////
    // Type Definitions //
    //////////////////////

    // validate floats
    if(!isNaN(value) && !isNaN(parseFloat(value))) {
      return value;
    }

    //validate Dates
    if (typeof value === 'string' && Date.parse(value)) {
      return new Date(value);
    }
    return value;
  }
  return normalize(value, collection);
};
//*******************************************
// module export
//*******************************************
module.exports = n1ql;
