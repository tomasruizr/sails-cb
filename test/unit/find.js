'use strict';
/**
 * Test dependencies
 */
var Adapter = require('../../');
var waterline = require('waterline');
var bootstrap = require('../bootstrap.js');
var async = require('async');





describe('.find()', function () {

  /////////////////////////////////////////////////////
  // TEST SETUP
  ////////////////////////////////////////////////////

  before(function (done) {

    // Insert 10 Users
    var users = [];

    for (var i = 0; i < 10; i++) {
      users.push({ first_name: 'find_user' + i, type: 'find test', age: i * 10 }); // include an integer field
    }

    Semantic.User.createEach(users, function (err, users) {
      if (err) return done(err);
      done();
    });
  });

  /////////////////////////////////////////////////////
  // TEST METHODS
  ////////////////////////////////////////////////////

  it('should return 10 records', function (done) {
    Semantic.User.find({ type: 'find test' }, function (err, users) {
      assert(!err);
      assert(Array.isArray(users));
      assert.strictEqual(users.length, 10);
      done();
    });
  });

  it('should return 1 record when searching for a specific record (integer test) with find', function (done) {
    Semantic.User.find({ age: 10 }, function (err, users) {
      console.log(users);
      assert(!err);
      assert(Array.isArray(users));
      assert.strictEqual(users.length, 1);
      done();
    });
  });

  it('should parse multi-level criteria', function (done) {
    Semantic.User.find({
      age: {
        lessThanOrEqual: 49 // should return half the records - from 0 to 40
      }
    }, function (err, users) {
      assert(!err);
      assert(Array.isArray(users));
      assert.equal(users.length, 5);
      done();
    });
  });

  it('should return a model instance', function (done) {
    Semantic.User.find({ type: 'find test' }, function (err, users) {
      assert(!err, err);
      assert(users[0].id);
      assert.equal(typeof users[0].fullName, 'function');
      assert.equal(toString.call(users[0].createdAt), '[object Date]');
      assert.equal(toString.call(users[0].updatedAt), '[object Date]', 'Expected the first user in results to have a Date for its `updatedAt` value, instead, the first user looks like:' + require('util').inspect(users[0], false, null));
      done();
    });
  });

  it('should work with no criteria passed in', function (done) {
    Semantic.User.find(function (err, users) {
      assert(!err);
      assert(Array.isArray(users));
      done();
    });
  });

  it('should work with IN values options', function (done) {
    Semantic.User.find({first_name:['find_user2', 'find_user3']}).sort('first_name').exec(function(err, users) {
      assert(!err);
      assert(Array.isArray(users));
      assert.equal(users.length, 2);
      assert.equal(users[0].first_name, 'find_user2');
      assert.equal(users[1].first_name, 'find_user3');
      done();
    });
  });

});
