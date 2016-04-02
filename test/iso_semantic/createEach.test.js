'use strict';
/**
 * Test dependencies
 */
var Adapter = require('../../');
var waterline = require('waterline');
var bootstrap = require('./bootstrap.js');
var async = require('async');
  describe('.createEach()', function() {
    // before(function () {
    //   Semantic.User.drop();
      
    // });
    // afterAll(function() {
    //   // Semantic.User.drop();
      
    // });

    /////////////////////////////////////////////////////
    // TEST METHODS
    ////////////////////////////////////////////////////

    it('should create a set of users', function(done) {
      var usersArray = [
        { first_name: 'createEach_1', type: 'createEach' },
        { first_name: 'createEach_2', type: 'createEach' }
      ];

      Semantic.User.createEach(usersArray, function(err, users) {
        assert(!err);
        assert(Array.isArray(users));
        assert.strictEqual(users.length, 2);
        done();
      });
    });

    it('should insert 2 records verififed by find', function(done) {
      setTimeout(function() {
        Semantic.User.find({ type: 'createEach' }, function(err, users) {
          assert(!err);
          assert.strictEqual(users.length, 2);
          done();
        });
      }, 100);
    });

    it('should return model instances', function(done) {
      var usersArray = [
        { first_name: 'createEach_3', type: 'createEach' },
        { first_name: 'createEach_4', type: 'createEach' }
      ];

      Semantic.User.createEach(usersArray, function(err, users) {
        assert(users[0].id);
        assert.equal(typeof users[0].fullName, 'function');
        assert.equal(toString.call(users[0].createdAt), '[object Date]');
        assert.equal(toString.call(users[0].updatedAt), '[object Date]');
        done();
      });
    });

  });
