'use strict';
var couchbase = require('couchbase');
var chai = require('chai');
var assert = chai.assert;
var N1qlQuery = require('couchbase').N1qlQuery;
var nquery = require('couchbase').N1qlQuery.fromString;
var async = require('async');
var defaults = {
  host: '127.0.0.1',
  port: '8091',
  username: '',
  password: '',
  bucket: 'default',
  bucketPassword: '',
  updateConcurrency: 'optimistic',
  maxOptimisticRetries: 3,
  lockTimeout: 15
};
describe('inserts and query tests', function () {

  describe('inserts and select with separate instances of couchbase clusters', function () {
    var cluster, bucket;
    beforeEach(function () {
      cluster = new couchbase.Cluster(defaults.host + ':' + defaults.port, defaults.username, defaults.password);
      bucket = cluster.openBucket(defaults.bucket, defaults.bucketPassword);
    });
    afterEach(function () {
      bucket.disconnect();
    });
    after(function (done) {
	  	this.timeout(10000);
	  	var cluster = new couchbase.Cluster(defaults.host + ':' + defaults.port, defaults.username, defaults.password);
	    var bucket = cluster.openBucket(defaults.bucket, defaults.bucketPassword);
	    // bucket.manager().flush(function() {
	    // 	bucket.disconnect();
	    // 	done();
	    // });
	    bucket.remove('newID', function() {
	    	done();
	    });

	  });

    it('should insert a document', function (done) {
      bucket.insert('newID', { name: 'Tomas' }, function (err, res) {
        assert(!err);
        done();
      });
    });
    it('should read the document', function (done) {
      // var q = nquery('select * from default where name = "Tomas"');
      // q.consistency =2;
      var query = N1qlQuery.fromString('select * from default where name = "Tomas"').consistency(2);
      bucket.query(query, function (err, res) {
        assert(!err);
        assert.equal(res[0].default.name, 'Tomas');
        done();
      });
    });
  });
  describe('inserts and select with same instances of couchbase clusters', function () {
    var cluster, bucket;
    before(function () {
      cluster = new couchbase.Cluster(defaults.host + ':' + defaults.port, defaults.username, defaults.password);
      bucket = cluster.openBucket(defaults.bucket, defaults.bucketPassword);
    });
    after(function (done) {
    	this.timeout(10000);
	  	var cluster = new couchbase.Cluster(defaults.host + ':' + defaults.port, defaults.username, defaults.password);
	    var bucket = cluster.openBucket(defaults.bucket, defaults.bucketPassword);
	    bucket.remove('newID', function() {
	    	done();
	    });
	    // bucket.manager().flush(function() {
	    // 	bucket.disconnect();
	    // 	done();
	    // });
    });
    it('should insert a document', function (done) {
      
      bucket.insert('newID', { name: 'Tomas' }, function (err, res) {
        assert(!err);
        done();
      });
    });
    it('should read the document', function (done) {
      // var q = nquery('select * from default where name = "Tomas"');
      // q.consistency = 3;
      // bucket.query(q, function (err, res) {
      var query = N1qlQuery.fromString('select * from default where name = "Tomas"').consistency(2);
      bucket.query(query, function (err, res) {
        assert(!err);
        assert.equal(res[0].default.name, 'Tomas');
        done();
      });
    });
  });
  describe('inserts and select inmediatly', function () {
    var cluster, bucket;
    before(function () {
      cluster = new couchbase.Cluster(defaults.host + ':' + defaults.port, defaults.username, defaults.password);
      bucket = cluster.openBucket(defaults.bucket, defaults.bucketPassword);
    });
    after(function (done) {
    	this.timeout(10000);
	  	var cluster = new couchbase.Cluster(defaults.host + ':' + defaults.port, defaults.username, defaults.password);
	    var bucket = cluster.openBucket(defaults.bucket, defaults.bucketPassword);
	    bucket.remove('newID', function() {
	    	done();
	    });
	    // bucket.manager().flush(function() {
	    // 	bucket.disconnect();
	    // 	done();
	    // });
    });
    it('should insert a document', function (done) {
      
      bucket.insert('newID', { name: 'Tomas' }, function (err, res) {
        assert(!err);
        var query = N1qlQuery.fromString('select * from default where name = "Tomas"').consistency(2);
        // var q = nquery('select * from default where name = "Tomas"');
	      // q.consistency = 3;
	      bucket.query(query, function (err, res) {
	        assert(!err);
	        assert.equal(res[0].default.name, 'Tomas');
	        done();
	      });
      });
    });
  });
  describe('insert 10 records and query a count', function () {
  	var cluster, bucket;
  	before(function () {
      cluster = new couchbase.Cluster(defaults.host + ':' + defaults.port, defaults.username, defaults.password);
      bucket = cluster.openBucket(defaults.bucket, defaults.bucketPassword);
    });
    after(function (done) {
    	this.timeout(20000);
      cluster = new couchbase.Cluster(defaults.host + ':' + defaults.port, defaults.username, defaults.password);
      bucket = cluster.openBucket(defaults.bucket, defaults.bucketPassword);
      var query = N1qlQuery.fromString('delete from default where name = "Tomas"').consistency(2);
      bucket.query(query, function () {
	    	bucket.disconnect();
	    	done();
	    });
    });
    it('should insert a document', function (done) {      
    	async.times(10, function(n, next) {
	      bucket.insert('newID' + n, { name: 'Tomas' }, function (err, res) {
	        assert(!err);
	        next();
	      });
    	}, done);
    });
    it('should read the document', function (done) {
      // var q = nquery('select *, meta(default).id from default where name = "Tomas"');
      // q.consistency = 2;
      // bucket.query(q, function (err, res) {
      var query = N1qlQuery.fromString('select * from default where name = "Tomas"').consistency(2);
      bucket.query(query, function (err, res) {
        assert(!err);
        assert.equal(res.length, 10);
        done();
      });
    });
  });
});
