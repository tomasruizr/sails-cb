'use strict';
/**
 * Manage all the related with the waterline connection to the couchbase server and buckets.
 *
 * @module sails-cb
 * @main sails-cb.js
 */
//*******************************************
//Dependencies
//*******************************************
var couchbase = require('couchbase');
var _ = require('lodash');
//*******************************************
// Constructor & Properties
//*******************************************

/**
 * Initialized the Module. Has no implementation.
 *
 * @class Connection
 * 
 * @constructor
 */
var Connection = function () {};
//*******************************************
// Static Properties
//*******************************************
Connection.connections = {};

//*******************************************
//Methods
//*******************************************

/**
 * Adds a connection to the connection pull in the static variable `Connection`.
 *
 * @method add
 *
 * @param  {String} connection The Connection identity or identifier.
 * @param  {Object} defaults   The dictionary object with the configurations related to this connections.
 */
Connection.prototype.add = function (connection, defaults) {
  var conn = _.extend({}, defaults, connection);
  var cluster = new couchbase.Cluster(conn.host + ':' + conn.port, conn.username, conn.password);
  var bucket = cluster.openBucket(conn.bucket, conn.bucketPassword);
  conn.cluster = cluster;
  conn.bucketName = conn.bucket;
  conn.bucket = bucket;
  conn.options = _.pick(conn, 
    'bucketName',
    'updateConcurrency',
    'maxOptimisticRetries',
    'consistency',
    'testMode',
    'persist_to',
    'replicate_to',
    'doNotReturn',
    'caseSensitive');
  Connection.connections[conn.identity] = conn;
};

/**
 * Public getter for a connection in the pull of connections.
 *
 * @method get
 *
 * @param  {String} identity The Connection identifier.
 *
 * @return {Object}          The Connection Object.
 */
Connection.prototype.get = function(identity){
  return Connection.connections[identity];
}
/**
 * Return a connection object by the identifier name.
 *
 * @method get
 *
 * @param  {String} id The identifier of the connection
 *
 * @return {Object}    Dictionary representing the waterline connection.
 */
// Connection.prototype.get = function (id) {
//   return Connection.connections[id];
// };
Connection.prototype.tearDown = function (conn, cb) {
  var self = this;
  if (typeof conn === 'function') {
    cb = conn;
    conn = null;
  }
  if (!conn) {
    _.each(Connection.connections, self.tearDown);
    return cb();
  }
  if (!Connection.connections[conn]) {
    return cb();
  }
  Connection.connections[conn].bucket.disconnect();
  delete Connection.connections[conn];
  cb();
};

/**
 * Validate the connection exists in the pull and Return a connection object
 *         by the identifier name.
 *
 * @method validate
 *
 * @param  {String} con The connection Identifier
 *
 * @return {Object} Dictionary representing the waterline connection.
 */
Connection.prototype.validate = function (con) {
  if (!con) {
    throw new Error('Create function not provided with Connection or Collection');
  }
  if (!Connection.connections[con]) {
    throw new Error('The connection is not registered in the pool of connections');
  }
  return this.get(con);
};

/**
 * Filter the options for a specific Task.
 *
 * @method marshalOptions
 *
 * @param  {[type]}       defaults  [description]
 * @param  {[type]}       options   [description]
 * @param  {[type]}       cbaseMeth [description]
 *
 * @return {[type]}                 [description]
 */
Connection.prototype.marshalOptions = function (defaults, options, cbaseMeth) {

  var mOptions = _.extend({}, defaults, options);

  switch (cbaseMeth) {

  case 'insert':
    mOptions = _.pick(mOptions, 'persist_to', 'replicate_to');
    break;
  case 'replace':
    mOptions = _.pick(mOptions, 'cas', 'expiry', 'flags',
      'format', 'persist_to', 'replicate_to', 'updateConcurrency');
    break;
  case 'remove':
    mOptions = _.pick(mOptions, 'cas', 'persist_to', 'replicate_to');
    break;
  case 'get':
    mOptions = _.pick(mOptions, 'expiry', 'format');
    break;
  case 'query':
    mOptions = _.pick(mOptions, 'consistency', 'testMode');
    break;
  }

  return mOptions;
};
//*******************************************
// module export
//*******************************************
module.exports = Connection;
