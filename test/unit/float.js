'use strict';
/**
 * Test dependencies
 */
var Adapter = require('../../');
var waterline = require('waterline');
var bootstrap = require('../bootstrap.js');
var async = require('async');





describe('with valid data', function () {

  /////////////////////////////////////////////////////
  // TEST METHODS
  ////////////////////////////////////////////////////

  it('should store proper float value', function (done) {
    Semantic.User.create({ percent: 0.001 }, function (err, createdRecord) {
      assert(!err);
      assert.strictEqual(createdRecord.percent, 0.001);
      Semantic.User.findOne({ id: createdRecord.id }, function (err, record) {
        assert(!err);
        assert.strictEqual(record.percent, 0.001);
        done();
      });
    });
  });

});
