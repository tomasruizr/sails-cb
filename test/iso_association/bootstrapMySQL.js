/**
 * Module Dependencies
 */

'use strict';
var Waterline = require('waterline');
var _ = require('lodash');
var async = require('async');
require('../globals');

var Adapter = require('sails-mysql');
var TestRunner = require('waterline-adapter-tests');

global.Associations = {};
var conn = {
      // schema:false,
      host: '127.0.0.1',
      port: '3306',
      username: 'root', //user in CB
      password: '123456', //PW in CB
      database: 'associations',
      // bucket: 'default',
      // bucketPassword: '',
      // updateConcurrency: 'optimistic',
      // maxOptimisticRetries: 3,
      // lockTimeout: 15,
      adapter: 'wl_tests',
      // consistency: 2,
      // testMode:true,
      // idStrategy: 'increment'
    };

// Require Fixtures
var fixtures = {
  PaymentBelongsFixture: require('./fixtures/belongsTo.child.fixture'),
  PaymentBelongsCustomFixture: require('./fixtures/belongsTo.child.customPK.fixture'),
  CustomerBelongsFixture: require('./fixtures/belongsTo.parent.fixture'),
  CustomerBelongsCustomFixture: require('./fixtures/belongsTo.parent.customPK.fixture'),
  PaymentHasManyFixture: require('./fixtures/hasMany.child.fixture'),
  CustomerHasManyFixture: require('./fixtures/hasMany.parent.fixture'),
  ApartmentHasManyFixture: require('./fixtures/hasMany.customPK.fixture'),
  PaymentManyFixture: require('./fixtures/multipleAssociations.fixture').payment,
  CustomerManyFixture: require('./fixtures/multipleAssociations.fixture').customer,
  StadiumFixture: require('./fixtures/hasManyThrough.stadium.fixture'),
  TeamFixture: require('./fixtures/hasManyThrough.team.fixture'),
  VenueFixture: require('./fixtures/hasManyThrough.venue.fixture'),
  TaxiFixture: require('./fixtures/manyToMany.taxi.fixture'),
  DriverFixture: require('./fixtures/manyToMany.driver.fixture'),
  TaxiWithSchemaFixture: require('./fixtures/manyToMany.taxi.withSchema.fixture'),
  DriverWithSchemaFixture: require('./fixtures/manyToMany.driver.withSchema.fixture'),
  TaxiCustomFixture: require('./fixtures/manyToMany.taxi.customPK.fixture'),
  DriverCustomFixture: require('./fixtures/manyToMany.driver.customPK.fixture'),
  UserOneFixture: require('./fixtures/oneToOne.fixture').user_resource,
  ProfileOneFixture: require('./fixtures/oneToOne.fixture').profile
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

  var connections = { associations: conn };

  Adapter.registerDatastore(conn, fixtures, () => {
    waterline.initialize({ adapters: { wl_tests: Adapter }, connections: connections }, function(err, _ontology) {
      if(err) return done(err);
  
      ontology = _ontology;
  
      Object.keys(_ontology.collections).forEach(function(key) {
        var globalName = key.charAt(0).toUpperCase() + key.slice(1);
        global.Associations[globalName] = _ontology.collections[key];
      });
  
      done();
    });
  })
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
