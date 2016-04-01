'use strict';
/**
 * Test dependencies
 */
var Adapter = require('../../');
var waterline = require('waterline');
var bootstrap = require('../bootstrap.js');
var async = require('async');
describe('registerConnection', function () {

  it('should not hang or encounter any errors', function () {
    assert(Adapter, 'Adapter is not defined');
  });
});


it('should normalize undefined values to null', function (done) {
  Semantic.User.create({ first_name: 'Yezy', last_name: undefined }, function (err, user) {
    assert(!err);
    assert.equal(user.last_name, null);
    done();
  });
});

it('should return rows in the correct order when creating multiple rows', function (done) {
  var testName = '.create() with a list, returning values';
  var users = [];

  for (var i = 0; i < 30; i++) {
    users.push({ first_name: 'test_' + i, type: testName });
  }
  Semantic.User.create(users, function (err, users) {
    assert(!err);
    users.forEach(function (val, idx) {
      assert.equal(users[idx].first_name, 'test_' + idx);
    });
    assert.equal(users.length, 30, 'Expecting 30 "users", but actually got ' + users.length + ': ' + require('util').inspect(users, false, null));
    done();
  });
});


describe('overloaded usage of create', function () {

  /////////////////////////////////////////////////////
  // TEST SETUP
  ////////////////////////////////////////////////////
  var testName = '.create() test create a list';

  before(function (done) {
    Semantic.User.drop(function() {
    var users = [];

    for (var i = 0; i < 4; i++) {
      users.push({ first_name: 'test_' + i, type: testName });
    }

    Semantic.User.create(users, function(err, res) {
        if (err){
            console.log('ERRORRRR');
            console.log('err');
        }
        // console.log(res);
        done();
    });
  });
    
});


  /////////////////////////////////////////////////////
  // TEST METHODS
  ////////////////////////////////////////////////////
  
  it('should always return the same results on 100 requests', function(done) {
    this.timeout(20000);
    async.times(100, function(n, next) {
        Semantic.User.find({ where: { type: testName}, sort: { first_name: 1 } }, function (err, users) {
            assert(!err);
            assert.equal(users.length, 4);   
            next();
        });
    }, function() {
        done();
    });
  });
  
  it('should have saved the proper values (with auto-increment values)', function (done) {
    Semantic.User.find({ where: { type: testName}, sort: { first_name: 1 } }, function (err, users) {
      if (err) return done(err);
      assert(!err);
      assert.equal(users.length, 4);
      assert.equal(users[0].first_name, 'test_0');
      done();
    });
  });
});
