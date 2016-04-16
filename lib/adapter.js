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
var cursor = require('waterline-cursor');
var PopulateBuffers = require('./populateBuffers');
var utils = require('./utils');
// ...


module.exports = (function () {

  /**
   * Reference to each collection that gets registered with this adapter.
   *
   * @type {Object}
   */
  var collections = {};

  /**
   * The waterline Adapter for Couchbase.
   *
   * @type {Object}
   */
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
    
    // This tells waterline that all the primary keys are considered strings.
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
      consistency: 1,
      testMode: false
    },


    /**
     *
     * This method runs when a model is initially registered
     * at server-start-time.  This is the only required method.
     *
     * @param  {Object}   connection The Connection Object
     * @param  {Array}   collection Array of collections associated with this connection.
     * @param  {Function} cb         Callback function when the function is done.
     */
    registerConnection: function (connection, colls, cb) {
      if (!connection.identity) {
        return cb(new Error('Connection is missing an identity.'));
      }
      if (connections.get(connection.identity)){
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
     * @param  {Function} cb         Callback function when the function is done.
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
     * Performs a DELETE operation for all the records of the same Document
     *         Type.
     *
     * @method drop
     *
     * @param  {String}   connection Connection Identifier
     * @param  {String}   collection Collection Name
     * @param  {Array}   relations  Relations. ???
     * @param  {Function} cb         Callback function when the function is
     *         done.
     *
     */
    drop: function (connection, collection, relations, cb) {
      connections.validate(connection, collection);
      if (relations && relations.length > 0) {
        throw new Error('There are relations in the Drop method... ??? Never hit this in the tests, Proceed to handle this case as you need. TR');
      }
      var conn = connections.get(connection);    
      var query = 'DELETE FROM ' + conn.bucketName + ' WHERE META().id LIKE "' + collection + '::%" RETURNING META().id';
      this.query(connection, collection, query, {}, function(err, res) {
        console.log('Found ' + res.length + ' results to delete in ' + collection);
        cb(err, res);
      });
    },

    /**
     * Method to interact directly with Couchbase N1QL.
     *
     * @method query
     *
     * @param  {String}   connectionName Connection Name
     * @param  {String}   collectionName Collection Name
     * @param  {String}   query          The query to execute.
     * @param  {Object}   options        Dictionary with the options for the
     *         query. For now the only attribute considered inside the options
     *         object is `consistency`, which can have one of the following
     *         integer values: 
     * NOT_BOUNDED number 1 This is the default (for
     *         single-statement requests).
     *
     * REQUEST_PLUS number 2 This implements strong consistency per request.
     *
     * STATEMENT_PLUS number 3 This implements strong consistency per
     *         statement.
     *
     * @param  {Function} cb         Callback function when the function is
     *         done.
     */
    query: function (connectionName, collectionName, query, options, cb) {
      
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
      bucket.query(n1ql.query(query, options.consistency), cb);
    },

    /**
     * Method to handle the relations between the waterline models.
     *
     * @method join
     *
     * @param  {String}   connectionName Connection Name
     * @param  {String}   collectionName Collection Name
     * @param  {Object}   criteria       Dictionary with the options and criteria for the joins.
     * @param  {Function} cb         Callback function when the function is
     *         done.
     *
     */
    join: function (connectionName, collectionName, criteria, cb) {
      var self = this;
      // Ignore `select` from waterline core
      if (typeof criteria === 'object') {
        delete criteria.select;
      }

      // var connectionObject = connections[connectionName];
      // var collection = collections[collectionName];

      // Populate associated records for each parent result
      // (or do them all at once as an optimization, if possible)
      cursor({

        instructions: criteria,
        parentCollection: collectionName,

        /**
         * Find some records directly (using only this adapter)
         * from the specified collection.
         *
         * @param  {String}   collectionIdentity
         * @param  {Object}   criteria
         * @param  {Function} cb
         */
        $find: function (collectionIdentity, criteria, _cb) {         
          return self.find(connectionName, collectionIdentity, criteria, _cb);
        },

        /**
         * Look up the name of the primary key field
         * for the collection with the specified identity.
         *
         * @param  {String}   collectionIdentity
         * @return {String}
         */
        $getPK: function (collectionIdentity) {
          return collections[collectionIdentity].primaryKey;
        },
        $populateBuffers: PopulateBuffers
      }, cb);
    },

    /**
     * Find Method. In case the where clause only contains an ID to look for,
     *         The document will by retrieved by Couchbase Key directly. If
     *         there is more than one key or a where condition it will be
     *         gathered with a N1QL query.
     *
     * @method find
     *
     * @param  {String}   connection Connection Name
     * @param  {String}   collection Collection
     * @param  {Object}   options    The waterline options for the operation,
     *         for example clauses like `where`, `sort`, `limit`, etc.
     *         Additionally it contains whatever property passed by the user
     *         in the Find method. See the Readme file for examples.
     * @param  {Function} cb         Callback function when the function is
     *         done.
     *
     */
    find: function (connection, collection, options, cb) {
      connections.validate(connection, collection);
      var conn = connections.get(connection);
      var self = this;
      var id;
      var opts;
      if (options && options.where && options.where[collections[collection].primaryKey]) {
        id = options.where[collections[collection].primaryKey];
        //prepare de id
        id = utils.prepareIds(id, collection);
      }
      if (conn.options.testMode){
        options.testMode = conn.options.testMode;
      }
      if (id && !Array.isArray(id) && _.keys(options.where).length === 1) {
        //get the options for find.
        opts = connections.marshalOptions(conn.options, options, 'get');
        //make the request
        conn.bucket.get(id, opts, function (err, res) {
          if (err) {
            if (err.code === couchbase.errors.keyNotFound){
              return cb(null,[]);
            }
            return cb(err);
          }
          var value = n1ql.normalizeResponse(res.value, collection, options);
          value.id = id;
          cb(null, value);
        });
      } else {
        if (id) { // we can assume it's an array of ids.
          if (_.isArray(id)){
            id = _.map(id, function(docId) {
              return utils.prepareIds(docId, collection);
            });
          }
          options.where[collections[collection].primaryKey] = id;
        }
        self.query(connection, collection, n1ql.buildSelect(collection, collections[collection], conn.bucketName, options), options, function (err, res) {
          if (err) {
            return cb(err);
          }
          var val = n1ql.normalizeResponse(res, collection, options);
          return cb(null, val);
        });
      }
    },

    /**
     * Creates a record in the Store.
     *
     * @method create
     *
     * @param  {String}   connection Connection Name
     * @param  {String}   collection Collection
     * @param  {Object}   values     The new Object to be stored.
     * @param  {Object}   options    The waterline options for the operation.
     *         Additionally it contains whatever property passed by the user
     *         in the Create method. See the Readme file for examples.
     *
     * @param  {Function} cb         Callback function when the function is
     *         done.
     */
    create: function (connection, collection, values, options, cb) {
      var conn = connections.validate(connection, collection);
      if (typeof options === 'function'){
        cb = options;
        options = conn.options;
      }
      var opts = connections.marshalOptions(conn.options, options, 'insert');
      var idPassedIn = !!values[collections[collection].primaryKey];
      
      ///////////////////////////////////////////////////////////////////////////////////////////
      // Here the ID or Document Key is used in case is passed as a value or is Generated.     //
      // Feel Free to change this line if you want to use other type of PK other than uuid's.  //
      // In any case consider that the key will be prefixed with the collection name, since is //
      // the way the Adapter recognizes the Document Type.                                     //
      ///////////////////////////////////////////////////////////////////////////////////////////
      var id = values[collections[collection].primaryKey] || uuid.v1();
      

      if (typeof id !== 'string'){
        id = id.toString();
      }
      id = id.startsWith(collection + '::') ? id : collection + '::' + id;
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
          if (err.code === couchbase.errors.keyAlreadyExists && idPassedIn === false) {
            // Regenerate ID
            id = collection + '::' + uuid.v1();
            // Retry
            conn.bucket.insert(id, values, opts, cb);
          } else {
            // Not a collision? Send the error back
            return cb(err);
          }
        } else { 
          return cb(null, doc);
        }
      });
    },

    /**
     * Updates a Couchbase Document by ID. This is used internally by the Update Method, it is not recommended to used directly. 
     *
     * @method updateById
     *
     * @param  {String}   connection Connection Name
     * @param  {String}   collection Collection
     * @param  {Object}   options    The waterline options for the operation,
     *         for example clauses like `where`, etc.
     *         Additionally it contains whatever property passed by the user
     *         in the UpdateById method. See the Readme file for examples.
     * @param  {Object}   values     The values of the Object to be updated. Don't need to be the hole Document, it may be only the modified properties.
     *
     * @param  {Function} cb         Callback function when the function is
     *         done.
     */
    updateById : function(connection, collection, options, values, cb) {
      var id = options.where[collections[collection].primaryKey];
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
              if (err && err.code === couchbase.errors.keyAlreadyExists) {
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

    /**
     * Updates a Couchbase Document. In case the where clause only contains an ID to look for,
     *         The document will by updated by Couchbase Key directly. If
     *         there is more than one key or a where condition it will be
     *         updated with a N1QL query. 
     *
     * @method updateById
     *
     * @param  {String}   connection Connection Name
     * @param  {String}   collection Collection
     * @param  {Object}   options    The waterline options for the operation,
     *         for example clauses like `where`, etc.
     *         Additionally it contains whatever property passed by the user
     *         in the UpdateById method. See the Readme file for examples.
     * @param  {Object}   values     The values of the Object to be updated. Don't need to be the hole Document, it may be only the modified properties.
     *
     * @param  {Function} cb         Callback function when the function is
     *         done.
     */
    update: function (connection, collection, options, values, cb) {
      var self = this;
      var conn = connections.validate(connection, collection);
      //if there's an id to update and is not an array.
      if (options && options.where && options.where[collections[collection].primaryKey] && !Array.isArray(options.where[collections[collection].primaryKey])){
        //prepare de id
        options.where[collections[collection].primaryKey] = utils.prepareIds(options.where[collections[collection].primaryKey], collection);
        //make the request
        return self.updateById(connection, collection, options, values, cb);
      } else {
        self.query(connection, collection, n1ql.buildUpdate(collection, collections[collection], conn.bucketName, options, values), options, function (err, res) {
          cb(err, n1ql.normalizeResponse(res, collection), options);
        });
      }
    },

    /**
     * Deletes Documents in the store. In case the where clause only contains an ID to look for,
     *         The document will by deleted by Couchbase Key directly. If
     *         there is more than one key or a where condition it will be
     *         deleted with a N1QL query.
     *
     * @method destroy
     *
     * @param  {String}   connection Connection Name
     * @param  {String}   collection Collection
     * @param  {Object}   options    The waterline options for the operation,
     *         for example clauses like `where`, etc.
     *         Additionally it contains whatever property passed by the user
     *         in the UpdateById method. See the Readme file for examples.
     *
     * @param  {Function} cb         Callback function when the function is
     *         done.
     */
    destroy: function (connection, collection, options, cb) {
      var conn = connections.validate(connection, collection);
      var self = this;
      var opts = connections.marshalOptions(options, 'remove'); // Marshaled options
      if (!options.where){
        return self.drop(connection, collection, null, cb);
      }
      if (options.where[collections[collection].primaryKey]) {
        //prepare de id
        options.where[collections[collection].primaryKey] = utils.prepareIds(options.where[collections[collection].primaryKey], collection);
        //make the request
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
          conn.bucket.remove(options.where[collections[collection].primaryKey], opts, function (err) {
            next(err, doc);
          });
        }], cb);
      }else {
        self.query(connection, collection, n1ql.buildDelete(collection, collections[collection], conn.bucketName, options), options, function (err, res) {
          cb(err, n1ql.normalizeResponse(res, collection, options));
        });
      }
    }
  };

  return adapter;
})();
