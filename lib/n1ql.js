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
  console.log(JSON.stringify(options));
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
  if (options && options.where) {
    query += this.where(options.where, collection, bucket, colDef, options);
  }
  if (options && options.groupBy) {
    query += ' GROUP BY ';
    // Normalize to array
    if (!Array.isArray(options.groupBy)) {
      options.groupBy = [options.groupBy];
    }
    query += options.groupBy.join(', ') + ' ';
  }

  if (options && options.sort) {
    query += ' ORDER BY ';

    // Sort through each sort attribute criteria
    _.each(options.sort, function (direction, attrName) {

      query += collection + '.' + attrName + ' ';

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
    query += 'LIMIT ' + options.limit + ' ';
  }

  if (_.has(options, 'skip') && (options.skip !== null && options.skip !== undefined)) {
    // Some MySQL hackery here.  For details, see:
    // http://stackoverflow.com/questions/255517/mysql-offset-infinite-rows
    // if (!options.limit) {
    //   query += 'LIMIT 18446744073709551610 ';
    // }
    query += 'OFFSET ' + options.skip + ' ';
  }
  console.log(query);
  return query;
};

n1ql.prototype.buildDelete = function (collection, colDef, bucket, options) {
  // 'delete from ' + conn.bucketName + ' where META(' + conn.bucketName + ').id like "' + collection + '::%"'
  var query = 'DELETE FROM ' + bucket + ' ' + collection + this.where(options.where, collection, bucket, colDef, options);
  if (!options.doNotReturn){
    query += ' RETURNING ' + collection + ', META(' + collection + ').id';
  }
  return query;
};

n1ql.prototype.buildUpdate = function (collection, colDef, bucket, options, values) {
  console.log(options);
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
  console.log(query);
  return query;
};
// {"first_name": {"contains": "user0"}, "type": "or test"}, 
// {"first_name": {"endsWith": "user1"}, "age": {">": 0 }, "type": "or test"}
// 
// (lower(first_name) LIKE "%user0%"
// AND lower(type) = "or test"
// OR lower(first_name) LIKE "%user0%", lower(type) = "or test"
// OR lower(first_name) LIKE "%user1"
// AND age > 0 AND lower(type) = "or test"
// OR lower(first_name) LIKE "%user1", age > 0, lower(type) = "or test") 
// AND META(userTable2).id LIKE "userTable2::%"

n1ql.prototype.wherePredicate = function(where, colDef, options){
  var self = this;
  var w = [];
  _.forIn(where, function (value, attr) {
    if (attr === 'or'){
      var or = [];
      var o;
      _.each(value, function(item) {
        o = self.wherePredicate(item, colDef, options);
        if (Array.isArray(o)){
          or.push('(' + o.join(' AND ') + ')');
        } else{
          or.push(o);
        }
      });
      w.push('(' + or.join(' OR ') + ')');
    } else if (_.isArray(value)){
      w.push(self.prepareWhereValue('IN', value, attr, colDef, options));
    } else if (typeof value === 'object') {
      // findLike workaround
      if (attr === 'like'){
        w.push(self.prepareWhereValue('like', _.values(value)[0], _.keys(value)[0], colDef, options));
      } else {  
        _.forIn(value, function (val, key) { //key = condition
          w.push(self.prepareWhereValue(key, val, attr, colDef, options));
        });
      }
    } else {
      w.push(self.prepareWhereValue('=', value, attr, colDef, options));
    }
  });
  return w;
};

n1ql.prototype.where = function (where, col, bucket, colDef, options) {
  if (!bucket) {
    bucket = col;
  }
  var w = this.wherePredicate(where, colDef, options);
  if (col && bucket) {
    w.push('META(' + col + ').id LIKE "' + col + '::%"');
  }
  return ' WHERE ' + w.join(' AND ');
};

n1ql.prototype.prepareWhereValue = function (key, value, attrStr, colDef, options) {
  var rawValue = value;
  value = this.prepareValue(value, attrStr, colDef, options);
  attrStr = this.prepareAttrs(attrStr, colDef, options);
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

n1ql.prototype.prepareAttrs = function(attr, colDef, options) {
  if (colDef.definition[attr].type === 'string' && !options.caseSensitive) {
    return 'lower('+attr+')';
  }
  if (colDef.definition[attr].type === 'date') {
    return 'MILLIS('+attr+')';
  }
  return attr;
};

n1ql.prototype.prepareValue = function (value, attr, colDef, options) {
  // var self = this;
  function prepare(val) {
    // Cast functions and arrays to strings
    if (_.isFunction(val)) {
      return val.toString();
    }
    // TODO: check for the associations
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
      if (isNaN(val)) {
        if (colDef.definition[attr].type === 'string' && !options.caseSensitive) {
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
n1ql.prototype.normalizeResponse = function (value, collection, options) {
  if (options && options.select){
    return value;
  }
  function normalize(value, collection) { // also brings key
    //validate undefined Values
    if (value === undefined || value === null) {
      return null;
    }
    //recursive search of types.
    // if (Object.keys(value).length === 2 && value.id) {
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
