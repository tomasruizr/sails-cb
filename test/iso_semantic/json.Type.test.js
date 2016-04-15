'use strict';
/**
 * Test dependencies
 */
var Adapter = require('../../');
var waterline = require('waterline');
var bootstrap = require('./bootstrap.js');
var async = require('async');





describe('Semantic Interface', function() {

  describe('JSON Type', function() {
    describe('with valid data', function() {

      /////////////////////////////////////////////////////
      // TEST METHODS
      ////////////////////////////////////////////////////

      it('should store proper object value', function(done) {
        Semantic.User.create({ obj: {foo: 'bar'} }, function(err, createdRecord) {
          assert(!err);
          assert.strictEqual(createdRecord.obj, Object(createdRecord.obj));
          assert.equal(createdRecord.obj.foo, 'bar');
          Semantic.User.findOne({id: createdRecord.id}, function (err, record) {
            assert(!err);
            assert.strictEqual(record.obj, Object(record.obj));
            assert.equal(record.obj.foo, 'bar');
            done();
          });
        });
      });

    });
  });
});
