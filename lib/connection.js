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
 * [Connection description]
 *
 * @class Connection
 * 
 * @constructor
 */
var Connection = function () {
  // connections = connections || {};
};
//*******************************************
// Static Properties
//*******************************************
Connection.connections = {};

//*******************************************
//Methods
//*******************************************
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
    'persist_to',
    'replicate_to',
    'doNotReturn',
    'caseSensitive');
  Connection.connections[conn.identity] = conn;
};
Connection.prototype.get = function (id) {
  return Connection.connections[id];
};
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
Connection.prototype.validate = function (con, col) {
  if (!con || !col) {
    throw new Error('Create function not provided with Connection or Collection');
  }
  if (!Connection.connections[con]) {
    throw new Error('The connection is not registred in the pool of connections');
  }
  return this.get(con);
};
Connection.prototype.marshalConfig = function (config) {

  var mConfig = {};

  // Combine host and port into host property
  mConfig.host = config.host + ':' + config.port;
  delete mConfig.port;

  // Filter out all config properties not used by the
  // Couchbase connection
  mConfig = _.pick(config, 'host', 'password', 'bucket');

  return mConfig;
};

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
    mOptions = _.pick(mOptions, 'consistency');
    break;
  }

  return mOptions;
};
Connection.prototype.DesDocBy_id = function(bucket, cb){
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
module.exports = Connection;
