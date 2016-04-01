'use strict';
/**
 * descriprion
 *
 * @module utils
 * @main utils
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
 * [connection description]
 *
 * @class connection
 * 
 * @constructor
 */
var connection = function (connections) {
  this.connections = connections || {};
};
//*******************************************
//Methods
//*******************************************
connection.prototype.add = function (connection, defaults) {
  var conn = _.extend({}, defaults, connection);
  var cluster = new couchbase.Cluster(conn.host + ':' + conn.port, conn.username, conn.password);
  var bucket = cluster.openBucket(conn.bucket, conn.bucketPassword);
  conn.cluster = cluster;
  conn.bucketName = conn.bucket;
  conn.bucket = bucket;
  this.connections[conn.identity] = conn;
};
connection.prototype.get = function (id) {
  return this.connections[id];
};
connection.prototype.tearDown = function (conn, cb) {
  var self = this;
  if (typeof conn === 'function') {
    cb = conn;
    conn = null;
  }
  if (!conn) {
    _.each(self.connections, self.tearDown);
    return cb();
  }
  if (!self.connections[conn]) {
    return cb();
  }
  self.connections[conn].bucket.disconnect();
  delete self.connections[conn];
  cb();
};
connection.prototype.validate = function (con, col) {
  if (!con || !col) {
    throw new Error('Create function not provided with Connection or Collection');
  }
  if (!this.connections[con]) {
    throw new Error('The connection is not registred in the pool of connections');
  }
  return this.get(con);
};
connection.prototype.marshalConfig = function (config) {

  var mConfig = {};

  // Combine host and port into host property
  mConfig.host = config.host + ':' + config.port;
  delete mConfig.port;

  // Filter out all config properties not used by the
  // Couchbase connection
  mConfig = _.pick(config, 'host', 'password', 'bucket');

  return mConfig;
};

connection.prototype.marshalOptions = function (defaults, options, cbaseMeth) {

  var mOptions = _.extend({}, defaults, options);

  switch (cbaseMeth) {

  case 'set':
  case 'replace':
    mOptions = _.pick(mOptions, 'cas', 'expiry', 'flags',
      'format', 'persist_to', 'replicate_to');
    break;
  case 'remove':
    mOptions = _.pick(mOptions, 'cas', 'persist_to', 'replicate_to');
    break;
  case 'get':
    mOptions = _.pick(mOptions, 'expiry', 'format');
    break;
  case 'query':
    mOptions = _.pick(mOptions, 'consistency');
    break;
  }

  return mOptions;
};
connection.prototype.DesDocBy_id = function(bucket, cb){
  var bmanager = bucket.manager();
  var ddocdata = {
    views: {
      by_id: {
        map: [ 'function(doc, meta) {',
               '  emit(meta.id, null);',
               '}'
             ].join('\n')
      },
    }
  };
  bmanager.getDesignDocument('docs', function(err, res) {
    if (!res || res === [] || res === {} || !res.views || !res.views.by_id){
      bmanager.upsertDesignDocument('docs', ddocdata, function(err) {
        if (err){
          console.log('Insertion of design document completed with error:', err);
          return cb(err);
        }
        return cb();
      });
    } else {
      return cb();
    }
  });
};
//*******************************************
// module export
//*******************************************
module.exports = connection;
