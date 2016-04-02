'use strict';
/**
 * Module Dependencies
 */
// ...
var async = require('async');
var couchbase = require('couchbase');
var uuid = require('uuid');
var _ = require('lodash');
var n1ql = new(require('./n1ql'))();
var connections = new(require('./connection'))();
// ...



/**
 * waterline-sails-cb
 *
 * Most of the methods below are optional.
 *
 * If you don't need / can't get to every method, just implement
 * what you have time for.  The other methods will only fail if
 * you try to call them!
 *
 * For many adapters, this file is all you need.  For very complex adapters, you may need more flexiblity.
 * In any case, it's probably a good idea to start with one file and refactor only if necessary.
 * If you do go that route, it's conventional in Node to create a `./lib` directory for your private submodules
 * and load them at the top of the file with other dependencies.  e.g. var update = `require('./lib/update')`;
 */
module.exports = (function () {


  // You'll want to maintain a reference to each collection
  // that gets registered with this adapter.

  var collections = {};


  // You may also want to store additional, private data
  // per-connection (esp. if your data store uses persistent
  // connections).
  //
  // Keep in mind that models can be configured to use different databases
  // within the same app, at the same time.
  //
  // i.e. if you're writing a MariaDB adapter, you should be aware that one
  // model might be configured as `host="localhost"` and another might be using
  // `host="foo.com"` at the same time.  Same thing goes for user, database,
  // password, or any other config.
  //
  // You don't have to support this feature right off the bat in your
  // adapter, but it ought to get done eventually.
  //

  var adapter = {

    // Set to true if this adapter supports (or requires) things like data types, validations, keys, etc.
    // If true, the schema for models using this adapter will be automatically synced when the server starts.
    // Not terribly relevant if your data store is not SQL/schemaful.
    //
    // If setting syncable, you should consider the migrate option,
    // which allows you to set how the sync will be performed.
    // It can be overridden globally in an app (config/adapters.js)
    // and on a per-model basis.
    //
    // IMPORTANT:
    // `migrate` is not a production data migration solution!
    // In production, always use `migrate: safe`
    //
    // drop   => Drop schema and data, then recreate it
    // alter  => Drop/add columns as necessary.
    // safe   => Don't change anything (good for production DBs)
    //
    syncable: false,
    pkFormat: 'string',

    identity: 'sails-cb',

    // Default configuration for connections
    defaults: {
      host: '127.0.0.1',
      port: '8091',
      username: '',
      password: '',
      bucket: 'default',
      bucketPassword: '',
      updateConcurrency: 'optimistic',
      maxOptimisticRetries: 3,
      persist_to: 1,
      replicate_to: 0,
      doNotReturn: false,
      caseSensitive: false,
      consistency: 1
    },


    /**
     *
     * This method runs when a model is initially registered
     * at server-start-time.  This is the only required method.
     *
     * @param  {[type]}   connection [description]
     * @param  {[type]}   collection [description]
     * @param  {Function} cb         [description]
     * @return {[type]}              [description]
     */
    registerConnection: function (connection, colls, cb) {
      if (!connection.identity) {
        return cb(new Error('Connection is missing an identity.'));
      }
      if (connections.get(connection.identity)) {
        return cb(new Error('Connection is already registered.'));
      }
      _.forIn(colls, function (atts, name) {
        collections[name] = _.pick(atts, 'primaryKey', 'definition');
      });
      connections.add(connection, this.defaults);
      cb();
    },


    /**
     * Fired when a model is unregistered, typically when the server
     * is killed. Useful for tearing-down remaining open connections,
     * etc.
     *
     * @param  {Function} cb [description]
     * @return {[type]}      [description]
     */
    // Teardown a Connection
    teardown: function (conn, cb) {
      connections.tearDown(conn, cb);
    },


    // Return attributes
    describe: function (connection, collection, cb) {
      // Add in logic here to describe a collection (e.g. DESCRIBE TABLE logic)
      return cb();
    },

    /**
     *
     * REQUIRED method if integrating with a schemaful
     * (SQL-ish) database.
     *
     */
    define: function (connection, collection, definition, cb) {
      // Add in logic here to create a collection (e.g. CREATE TABLE logic)
      return cb();
    },

    /**
     *
     * REQUIRED method if integrating with a schemaful
     * (SQL-ish) database.
     *
     */
    drop: function (connection, collection, relations, cb) {
      connections.validate(connection, collection);
      if (relations && relations.length > 0) {
        throw new Error('llegaron las relaciones al drop');
      }
      // var conn = connections.get(connection);    
      // console.log('delete from ' + conn.bucketName + ' where META(' + conn.bucketName + ').id like "' + collection + '::%"');
      // this.query(connection, collection, 'delete from ' + conn.bucketName + ' where META(' + conn.bucketName + ').id like "' + collection + '::%"', {consistency:2}, function(err, res) {
      //   console.log('llegue', err, res);
      //   cb();
      // });
      var ViewQuery = couchbase.ViewQuery;
      var bucket = connections.get(connection).bucket;
      connections.DesDocBy_id(bucket, function(err) {
        if (err){
          return cb(err);
        }
        else{
          var vquery = ViewQuery.from('docs', 'by_id');
          vquery.stale(1);
          vquery.range(collection + '::', collection + '::' + '\u02ad', false);
          bucket.query(vquery, function (error, results) {
            if (error) {
              return console.log(error);
            }
            console.log('Found ' + results.length + ' documents to delete');
            async.each(results, function(result, done) {
              bucket.remove(result.id, {persist_to:1}, function () {
                // console.log(result.id);
                done();
              });
            }, cb);
          });
        }
      });
    },

    query: function (connectionName, collectionName, query, options, cb) {
      // NOT_BOUNDED number  1 
      // This is the default (for single-statement requests).

      // REQUEST_PLUS  number  2 
      // This implements strong consistency per request.

      // STATEMENT_PLUS  number  3 
      // This implements strong consistency per statement.
      
      if (typeof query === 'object' && query.error){
        return cb(query.error);
      } 
      
      var conn = connections.validate(connectionName,collectionName);
      options = connections.marshalOptions(conn.options, options, 'query');
      var bucket = conn.bucket;
      if (typeof options === 'function'){
        cb = options;
        options = null;
      }
      bucket.query(n1ql.query(query, options.consistency), function(err, res) {
        if (err) {
          return console.log(err);
        }
        cb(err, res);
      });
    },


    /**
     *
     * REQUIRED method if users expect to call Model.find(), Model.findOne(),
     * or related.
     *
     * You should implement this method to respond with an array of instances.
     * Waterline core will take care of supporting all the other different
     * find methods/usages.
     *
     */
    find: function (connection, collection, options, cb) {
      connections.validate(connection, collection);
      var conn = connections.get(connection);
      var self = this;
      //if id is present get the document directly
      if (options && options.where && options.where.id) {
        var opts = connections.marshalOptions(conn.options, options, 'get');
        conn.bucket.get(options.where.id, opts, function (err, res) {
          if (err) {
            return cb(err);
          }
          var value = n1ql.normalizeResponse(res.value, collection, options);
          value.id = options.where.id;
          cb(null, value);
        });
      } else {
        // self.query(connection, collection, 'select *, META('+collection+').id from ' + conn.bucketName + ' ' + collection + this.where(options.where, collection, collection), function(err, res) {
        self.query(connection, collection, n1ql.buildSelect(collection, collections[collection], conn.bucketName, options), options, function (err, res) {
          if (err) {
            return cb(err);
          }
          var val = n1ql.normalizeResponse(res, collection, options);
          return cb(null, val);
        });
      }
    },

    create: function (connection, collection, values, options, cb) {
      var conn = connections.validate(connection, collection);
      if (typeof options === 'function'){
        cb = options;
        options = conn.options;
      }
      var opts = connections.marshalOptions(conn.options, options, 'insert');
      var idPassedIn = !!values.id;
      // make the auto incremental.
      var id = values.id || collection + '::' + uuid.v1();
      var doc;
      if (options.doNotReturn){
        doc = id;
      } else{
        doc = values;
        doc.id = id;
      }
      conn.bucket.insert(id, values, opts, function (err) {
        if (err) {
          // If the key already exists and was not passed in, we have a
          // UUID collision.  Retry once.  If there are multiple collisions
          // something's fucked or hell has frozen over, return the error.
          if (err === couchbase.errors.keyAlreadyExists && idPassedIn === false) {
            // Regenerate ID
            id = collection + '::' + uuid.v1();
            // Retry
            conn.bucket.insert(id, values, opts, function (err) {
              if (err) {
                cb(err); // Still failing?  Too bad.
              } else {
                return cb(null, doc);
              }
            });
          } else {
            // Not a collision? Send the error back
            return cb(err);
          }
        } else { 
          return cb(null, doc);
        }
      });
    },


    updateById : function(connection, collection, options, values, cb) {
      var id = options.where.id;
      var conn = connections.get(connection);
      var doNotReturn = options.doNotReturn;
      options = connections.marshalOptions(conn.options, options, 'replace');
      var updatedDoc;
      function optimist() {
        // Fetch the document
        conn.bucket.get(id, function (err, result) {
          if (err) {
            cb(err);
          } else {
            //Add CAS to options and marshal them
            options.cas = result.cas;
            options = connections.marshalOptions(options, 'replace');
            // Merge the old and new JSON docs, overwriting
            // old properties with new ones
            updatedDoc = _.extend(result.value, values);
            // Write the updated document back to the DB
            conn.bucket.replace(id, updatedDoc, options, function (err) {
              var retryCount;
              // If the CAS value changed...
              if (err === couchbase.errors.keyAlreadyExists) {
                //If we haven't exceeded maxOptimisticRetries
                if (retryCount < conn.options.maxOptimisticRetries) {
                  //Increment the count and recurse
                  retryCount++;
                  return optimist();
                } else { //If exceeded, return the error
                  cb(err);
                }
              } else { //Otherwise we're golden
                updatedDoc.id = id;
                if (doNotReturn){
                  cb (err, []);
                } else {
                  cb(err, updatedDoc);
                }
              }
            });
          }
        });
      }
      if (options.updateConcurrency === 'optimistic') {
        // Executes an optimistic update
        optimist();

      } else {
        //Otherwise lock the document and proceed...
        conn.bucket.getAndLock(id, function (err, result) {
          if (err) {
            cb(err);
          } else {
            //Add CAS to options and marshal them
            options.cas = result.cas;
            options = connections.marshalOptions(options, 'replace');
            // Merge the old and new JSON docs, overwriting
            // old properties with new ones
            updatedDoc = _.extend(result.value, values);
            // Write the updated document back to the DB
            // This operation automatically unlocks the document
            conn.bucket.replace(id, updatedDoc, options, function (err, result) {
              if (err) {
                cb(err);
              } else {
                if (doNotReturn){
                  cb (err, []);
                } else {
                  cb(null, result.value);
                }
              }
            });
          }
        });
      }
      
    },

    update: function (connection, collection, options, values, cb) {
      var self = this;
      var conn = connections.validate(connection, collection);
      if (options && options.where && options.where.id){
        return self.updateById(connection, collection, options, values, cb);
      } else {
        self.query(connection, collection, n1ql.buildUpdate(collection, collections[collection], conn.bucketName, options, values), options, function (err, res) {
          cb(err, n1ql.normalizeResponse(res, collection), options);
        });
      }
    },

    destroy: function (connection, collection, options, cb) {
      var conn = connections.validate(connection, collection);
      var self = this;
      var opts = connections.marshalOptions(options, 'remove'); // Marshaled options
      if (!options.where){
        return self.drop(connection, collection, null, cb);
      }
      if (options.where.id) {
        async.waterfall([function(next) {
          if (!options.doNotReturn){
            self.find(connection, collection, options, function(err, res) {
              if (!Array.isArray(res)){
                res = [res];
              }
              next(err, res);
            });
          } else {
            next(null, []);
          }
        }, function(doc, next) {
          conn.bucket.remove(options.where.id, opts, function (err) {
            next(err, doc);
          });
        }],function(err, doc) {
            cb(err, doc);
        });
      }else {
        self.query(connection, collection, n1ql.buildDelete(collection, collections[collection], conn.bucketName, options), options, function (err, res) {
          cb(err, n1ql.normalizeResponse(res, collection), options);
        });
      }
    }

    /*

    // Custom methods defined here will be available on all models
    // which are hooked up to this adapter:
    //
    // e.g.:
    //
    foo: function (connection, collection, options, cb) {
    return cb(null,"ok");
    },
    bar: function (connection, collection, options, cb) {
    if (!options.jello) return cb("Failure!");
    else return cb();
    destroy: function (connection, collection, options, values, cb) {
    return cb();
    }

    // So if you have three models:
    // Tiger, Sparrow, and User
    // 2 of which (Tiger and Sparrow) implement this custom adapter,
    // then you'll be able to access:
    //
    // Tiger.foo(...)
    // Tiger.bar(...)
    // Sparrow.foo(...)
    // Sparrow.bar(...)


    // Example success usage:
    //
    // (notice how the first argument goes away:)
    Tiger.foo({}, function (err, result) {
    if (err) return console.error(err);
    else console.log(result);

    // outputs: ok
    });

    // Example error usage:
    //
    // (notice how the first argument goes away:)
    Sparrow.bar({test: 'yes'}, function (err, result){
    if (err) console.error(err);
    else console.log(result);

    // outputs: Failure!
    })
    */
  };

  return adapter;
})();
