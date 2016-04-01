/*---------------------------------------------------------------
  :: sails-couchbase
  -> adapter
---------------------------------------------------------------*/

var async = require('async');
var couchbase = require('couchbase');
var uuid = require('uuid');
var crypto = require('crypto');
var _ = require('underscore');



module.exports = (function() {

    var connections = { },          // Contains open connections
        collToConnIndex = { },      // An index of collection names to connection keys
        collToConfigIndex = { },    // An index of collection names to configuration objects
  
    
  adapter = {

  syncable: false,

  
  defaults: {
      host: '127.0.0.1',
      port: '8091',
      password: '',
      bucket: 'default',
      updateConcurrency: 'optimistic',
      maxOptimisticRetries: 3,
      lockTimeout: 15
  },  


  registerCollection: function(collection, cb) {  
      
      var connKey,                          // Connection key (MD5 hash of config object for this collection) 
          collName = collection.identity,   // The name of the collection being registered
          mConfig;                          // A marshaled config object for this collection
      
      // If config was not passed in, use the default.  Otherwise merge them.
      if(!collection.hasOwnProperty('config'))
          collection.config = collection.defaults;
      else
          collection.config = _.extend(collection.defaults, collection.config); 
      
      // Create a marshaled config object
      mConfig = marshalConfig(collection.config);

      // We only want to spawn a new connection if a connection with this 
      // config does not already exist.
      
      // Create a connection key from an MD5 hash of the stringified collection.config
      connKey = JSON.stringify(mConfig);      
      connKey = crypto.createHash('md5').update(connKey).digest('base64');
      
      // If the connection key already exists.. 
      if(connections.hasOwnProperty(connKey)) {
          
          // Only add indexes from this collection name to 
          // this connection key and connection config.
          collToConnIndex[collName] = connKey;
          collToConfigIndex[collName] = collection.config;  
          
          cb();  // That's all folks...
          
      } else {
          
          // Otherwise add a new connection
          connections[connKey] = new couchbase.Connection(mConfig, function(err) {
              
              if(err)
                  cb(err);
              else {
                    
                  // And add indexes from this collection name to this
                  // connection key and connection config.
                  collToConnIndex[collName] = connKey;
                  collToConfigIndex[collName] = collection.config;  
                    
                  cb(); //Away we go...
              }     
          }); 
      }
  },


  teardown: function(collectionName, cb) {
      
      var connKey = collToConnIndex[collectionName],    // Connection key
          connRefExists;                                // Does reference to this connection still exist?
      
      // Remove this collection from the connection index
      delete collToConnIndex[collectionName];
      
      // We only want to shut down the connection if another collection isn't using it.
      // Does a reference to it still exist?
      connRefExists = _.chain(collToConnIndex).values().contains(connKey).value();
      
      //If not...
      if(!connRefExists) {
          
          // Kill it
          connections[connKey].shutdown();
          
          // Dispose of the carpet you rolled the body in
          delete connections[connKey];
          
          // Run away!
          cb(null, 'connection terminated');
          
      } else
          cb(null, 'connection maintained');
        
    
  },

  
  create: function(collectionName, values, cb) {
      
      var connKey = collToConnIndex[collectionName],    // Connection key
          id,                                           // Document ID (key)
          idPassedIn = false;
      
      // If an ID was passed in
      if(values.id) {
          
          // Copy the ID property into our local var and delete it.  
          // We don't need it added to the record.
          id = values.id;
          delete values.id;
          
          idPassedIn = true;
          
      } else {
          
          // Otherwise generate the ID as "collectionName"_"UUID" 
          id = collectionName + '::' + uuid.v1();
      }
      
      //Add the jsonType
      values.jsonType = collectionName;
      
      //Create the document
      connections[connKey].add(id, values, function(err, result) {
          
          if(err) {
              
              // If the key already exists and was not passed in, we have a
              // UUID collision.  Retry once.  If there are multiple collisions
              // something's fucked or hell has frozen over, return the error.
              if(err === couchbase.errors.keyAlreadyExists && idPassedIn === false) {
                  
                  // Regenerate ID
                  id = collectionName + '::' + uuid.v1();
                  
                  // Retry
                  connections[connKey].add(id, values, function(err, result) {
                      if(err)
                          cb(err);  // Still failing?  Too bad.
                      else {
                          
                          // Remove the cas values and add the key to the result
                          result.id = id;
                          delete result.cas;
                          
                          cb(null, result);
                      }
                  });
                  
              } else {
                  
                  // Not a collision? Send the error back
                  cb(err);
              }
              
          } else {
              
              // Remove the cas values and add the key to the result
              result.id = id;
              delete result.cas;
              
              cb(null, result); 
          }   
         
      });  
  },
  

  find: function(collectionName, options, cb) {

      var connKey = collToConnIndex[collectionName],    // Connection key
          results = [],                                 // Result array
          Moptions = marshalOptions(options, 'get');    // Marshaled options 
    
      connections[connKey].get(options.where.id, Moptions, function(err, result) {
          
          if(err)
              cb(err);
          else {
              
              result = result.value;         // Get rid of the CAS stuff
              result.id = options.where.id;  // Add the ID to the result
              results.push(result);          // Add it to the result array
              cb(null, results);
          }
        
      });
  },
  

  update: function(collectionName, options, values, cb) {
      
      var config = collToConfigIndex[collectionName],   // Configuration object for this collection
          connKey = collToConnIndex[collectionName],    // Connection key
          updatedDoc,                                   // Updated JSON document
          where = options.where,                        // Where object (eg. where.id = '34')
          retryCount = 0;                               // Number of optimistic retries 
      
      //If no concurrency passed in, set default
      if(!options.hasOwnProperty('updateConcurrency'))  
          options.updateConcurrency = config.updateConcurrency;  
              
      if(options.updateConcurrency === 'optimistic')
          optimist();   //Perform an optimistic update
      else {
              
          //Otherwise lock the document and proceed...
          connections[connKey].lock(where.id, function(err, result) {
                  
              if(err)
                  cb(err);
              else {
                                
                  //Add CAS to options and marshal them
                  options.cas = result.cas;
                  options = marshalOptions(options, 'replace');
                                
                  // Merge the old and new JSON docs, overwriting
                  // old properties with new ones
                  updatedDoc = _.extend(result.value, values); 
                        
                  // Write the updated document back to the DB
                  // This operation automatically unlocks the document
                  connections[connKey].replace(where.id, updatedDoc, options, function(err, result) {
                            
                      if(err)
                          cb(err);
                      else
                          cb(null, result);
                            
                  });
              }
                  
          });
      }  
      
      // Executes an optimistic update
      function optimist() {                     
          
          // Fetch the document
          connections[connKey].get(where.id, function(err, result) {
                        
              if(err)
                  cb(err);
              else {
                            
                  //Add CAS to options and marshal them
                  options.cas = result.cas;
                  options = marshalOptions(options, 'replace');
                            
                  // Merge the old and new JSON docs, overwriting
                  // old properties with new ones
                  updatedDoc = _.extend(result.value, values); 
                            
                  // Write the updated document back to the DB
                  connections[connKey].replace(where.id, updatedDoc, options, function(err, result) {
                            
                  // If the CAS value changed...
                      if(err === couchbase.errors.keyAlreadyExists) {
                                    
                          //If we haven't exceeded maxOptimisticRetries
                          if(retryCount < config.maxOptimisticRetries) {
                                        
                              //Increment the count and recurse
                              retryCount++;
                              return optimist();
                                        
                          } else {      //If exceeded, return the error
                              cb(err);
                          }
                                    
                      } else if(err) {  //If a non-CAS error return the error
                          cb(err);
                                    
                      } else {          //Otherwise we're golden
                          cb(null, result);
                      } 
                            
                  });               
              }                                 
          });           
      };              
      
  },


  destroy: function(collectionName, options, cb) {

      var connKey = collToConnIndex[collectionName],    // Connection key
          id = options.where.id,                        // ID (key) of document to destroy
          options = marshalOptions(options, 'remove');  // Marshaled options
    
      //Remove the document
      connections[connKey].remove(id, options, function(err, result) {
    
          if(err)
              cb(err);
          else
              cb(null, result);
      });
  },

  
  identity: 'sails-couchbase'


 };
  
  ////////////////////////////////////////////////////////
  //////////////     Private Methods     /////////////////
  ////////////////////////////////////////////////////////
  

  function marshalConfig(config) {
      
      var mConfig = { };
      
      // Combine host and port into host property
      mConfig.host = config.host + ':' + config.port;
      delete mConfig.port;
      
      // Filter out all config properties not used by the
      // Couchbase connection
      mConfig = _.pick(config, 'host', 'password', 'bucket');
      
      return mConfig;
  }
  
  function marshalOptions(options, cbaseMeth) {
      
      var mOptions = { };
      
      switch(cbaseMeth) {
      
        case "set":
        case "replace":
            mOptions = _.pick(options, 'cas', 'expiry', 'flags',
                             'format', 'persist_to', 'replicate_to');
            break;
        case "remove":
            mOptions = _.pick(options, 'cas', 'persist_to', 'replicate_to');
            break;
        case "get":
            mOptions = _.pick(options, 'expiry', 'format');
            break;
      }
      
      return mOptions;
  }
  
  return adapter;
  
})();