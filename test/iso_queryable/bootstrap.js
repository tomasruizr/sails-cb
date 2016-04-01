'use strict';
var Waterline = require('waterline');
var _ = require('lodash');
var async = require('async');
require('../globals');

var Adapter = require('../../');
var TestRunner = require('waterline-adapter-tests');

global.Queryable = {};

/**
 * Integration Test Runner
 *
 * Uses the `waterline-adapter-tests` module to
 * run mocha tests against the specified interfaces
 * of the currently-implemented Waterline adapter API.
 */
// new TestRunner({

//     // Load the adapter module.
//     adapter: Adapter,

//     // Default adapter config to use.
//     config: {
//         schema: false
//     },

//     // The set of adapter interfaces to test against.
//     // (grabbed these from this adapter's package.json file above)
//     // interfaces: interfaces

//     // Most databases implement 'semantic' and 'queryable'.
//     //
//     // As of Sails/Waterline v0.10, the 'associations' interface
//     // is also available.  If you don't implement 'associations',
//     // it will be polyfilled for you by Waterline core.  The core
//     // implementation will always be used for cross-adapter / cross-connection
//     // joins.
//     //
//     // In future versions of Sails/Waterline, 'queryable' may be also
//     // be polyfilled by core.
//     //
//     // These polyfilled implementations can usually be further optimized at the
//     // adapter level, since most databases provide optimizations for internal
//     // operations.
//     //
//     // Full interface reference:
//     // https://github.com/balderdashy/sails-docs/blob/master/adapter-specification.md
// });

/**
 * Module Dependencies
 */


// Require Fixtures
var fixtures = {
  UserFixture: require('./fixtures/crud.fixture'),
};
var conn = {
      host: '127.0.0.1',
      port: '8091',
      username: '',
      password: '',
      bucket: 'default',
      bucketPassword: '',
      updateConcurrency: 'optimistic',
      maxOptimisticRetries: 3,
      lockTimeout: 15,
      adapter: 'wl_tests',
      consistency: 2
    };

/////////////////////////////////////////////////////
// TEST SETUP
////////////////////////////////////////////////////

var waterline, ontology;

before(function(done) {

  waterline = new Waterline();

  Object.keys(fixtures).forEach(function(key) {
    waterline.loadCollection(fixtures[key]);
  });

  var connections = { queryable: conn };
  
  var defaults = { migrate: 'alter' };

  waterline.initialize({ adapters: { wl_tests: Adapter }, connections: connections, defaults: defaults }, function(err, _ontology) {
    if(err) return done(err);

    ontology = _ontology;

    Object.keys(_ontology.collections).forEach(function(key) {
      var globalName = key.charAt(0).toUpperCase() + key.slice(1);
      global.Queryable[globalName] = _ontology.collections[key];
    });

    done();
  });
});

after(function(done) {

  function dropCollection(item, next) {
    if(!Adapter.hasOwnProperty('drop')) return next();
    ontology.collections[item].drop(function(err) {
      if(err) return next(err);
      next();
    });
  }

  async.each(Object.keys(ontology.collections), dropCollection, function(err) {
    if(err) return done(err);
    waterline.teardown(done);
  });

});
