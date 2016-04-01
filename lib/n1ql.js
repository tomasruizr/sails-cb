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

n1ql.prototype.buildSelect = function (collection, bucket, options) {
  //'select *, META('+collection+').id from ' + conn.bucketName + ' ' + collection + this.where(options.where, collection, collection)
  var query = 'SELECT ';
  var fields = ['*', 'META(' + collection + ').id'];
  query += fields.join(', ');
  query += ' FROM ' + bucket + ' ' + collection;
  if (options && options.where) {
    query += this.where(options.where, collection);
  }
  if (options && options.groupBy) {
    query += 'GROUP BY ';

    // Normalize to array
    if (!Array.isArray(options.groupBy)) {
      options.groupBy = [options.groupBy];
    }
    query = options.groupBy.join(', ') + ' ';
  }

  if (options && options.sort) {
    query += 'ORDER BY ';

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
  return query;
};

n1ql.prototype.buildDelete = function (collection, bucket, options) {
  // 'delete from ' + conn.bucketName + ' where META(' + conn.bucketName + ').id like "' + collection + '::%"'
  var query = 'DELETE FROM ' + bucket + this.where(options.where);
  if (!options.doNotReturn){
    query += ' RETURNING ' + collection;
  }
  return query;
};

n1ql.prototype.buildUpdate = function (collection, bucket, options, values) {
  // update default userTable set name = 'CHANGED' WHERE name="TOMAS" returning userTable
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
  var query = 'UPDATE ' + bucket + ' ' + collection + set + this.where(options.where, collection, bucket);
  if (!options.doNotReturn){
    query += ' RETURNING ' + collection + ', META(' + collection + ').id';
  }
  console.log(query);
  return query;
};


n1ql.prototype.where = function (where, col, bucket) {
  var self = this;
  if (!bucket) {
    bucket = col;
  }
  var w = [];
  _.forIn(where, function (value, attr) {
    if (_.isArray(value)){
      w.push(self.prepareWhereValue('IN', value, attr));
    }
    else if (typeof value === 'object') {
      _.forIn(value, function (val, key) { //key = condition
        w.push(self.prepareWhereValue(key, val, attr));
      });
    } else {
      w.push(self.prepareWhereValue('=', value, attr));
    }
  });
  if (col && bucket) {
    w.push('META(' + col + ').id LIKE "' + col + '::%"');
  }
  return ' WHERE ' + w.join(' AND ');
};

n1ql.prototype.prepareValue = function (value) {
  var self = this;
  // Cast dates to SQL
  function prepare(val) {
    if (_.isDate(val)) {
      return self.toStringDate(val);
    }
    // Cast functions and arrays to strings
    else if (_.isFunction(val)) {
      return val.toString();
    }
    else if (_.isArray(val)){
      return _.map(val, function(item) {
        return prepare(item);
      }).toString();
    }
    else if (isNaN(val)) {
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

n1ql.prototype.prepareWhereValue = function (key, value, attrStr) {
  var rawValue = value;
  value = this.prepareValue(value);
  if (key === '<' || key === 'lessThan') {
    return attrStr + '<' + value;
  } else if (key === '<=' || key === 'lessThanOrEqual') {
    return attrStr + '<=' + value;
  } else if (key === '>' || key === 'greaterThan') {
    return attrStr + '>' + value;
  } else if (key === '>=' || key === 'greaterThanOrEqual') {
    return attrStr + '>=' + value;
  } else if (key === '!' || key === 'not') {
    if (value === null) {
      return attrStr + ' IS NOT NULL';
    } else if (isNaN(rawValue) && rawValue.toUpperCase() === 'MISSING') {
      return attrStr + ' IS NOT MISSING';
    } else if (_.isArray(value)) {
      return '(' + attrStr + ' NOT IN [' + value + '])';
    } else {
      return attrStr + '<>' + value;
    }
  } else if (key === 'like') {
    return attrStr + ' LIKE ' + value;
  } else if (key === 'contains') {
    return attrStr + ' LIKE "%' + rawValue + '%"';
  } else if (key === 'startsWith') {
    return attrStr + ' LIKE "' + rawValue + '%"';
  } else if (key === 'endsWith') {
    return attrStr + ' LIKE "%' + rawValue + '"';
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
n1ql.prototype.normalizeResponse = function (value) {
  function normalize(value) { // also brings key
    //validate undefined Values
    if (value === undefined || value === null) {
      return null;
    }
    //recursive search of types.
    if (Object.keys(value).length === 2 && value.id) {
      value[Object.keys(value)[1]].id = value.id;
      value = value[Object.keys(value)[1]];
    }
    if (value && value.constructor === Array) {
      return _.map(value, normalize);
    }
    if (typeof value === 'object') {
      return _.mapValues(value, normalize);
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
  return normalize(value);
};
//*******************************************
// module export
//*******************************************
module.exports = n1ql;
