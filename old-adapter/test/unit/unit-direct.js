var adapter = require('../lib/adapter.js'),
    assert = require('assert'),
    _ = require('underscore');
        


describe('adapter', function() {
    
        var collection = { },
        testDocID;
        
        collection.defaults = adapter.defaults;
        collection.identity = 'test';
        
        describe('registerCollection', function() {

            it('should not hang or encounter any errors', function(cb) {
                
                adapter.registerCollection(collection, cb);
            });

        });

        describe('create', function() {
            
            it('should create a new document in the database without errors', function(cb) {
                
                adapter.create(collection.identity, {name: 'Knuth the Oracle'}, function(err, result) {
                    
                    assert(!err, 'adapter.create returned an error: ' + err);
                    assert(result.id, 'adapter.create did not return a document id');
                    
                    testDocID = result.id;
                    
                    cb();
                });
            });
        });

        describe('optimistic-update', function() {
            
            it('should perform an optimistic update on the created document without errors', function(cb) {
                
                adapter.update(collection.identity, {where: {id: testDocID}, concurrency: 'optimistic'},
                               {name: 'Stallman the Philosopher'}, function(err, result) {
                    
                    assert(!err, 'adapter.update returned an error: ' + err);
                    
                    cb();          
                });
            });
        });

        describe('pessimistic-update', function() {
            
            it('should perform a pessimistic update on the created document without errors', function(cb) {
                
                adapter.update(collection.identity, {where: {id: testDocID}, concurrency: 'pessimistic'},
                           {name: 'Linus the Barbarian'}, function(err, result) {
                
                    assert(!err, 'adapter.update returned an error: ' + err);
                    
                    cb();
                });
            });
        });

        describe('find', function() {
            
            it('should fetch the document without errors', function(cb) {
                
                adapter.find(collection.identity, {where: {id: testDocID}}, function(err, result) {
                    
                    //Get the first result (there will only be one)
                    result = _.first(result);
                    
                    assert(!err, 'adapter.find returned an error: ' + err);
                    assert.deepEqual(result.name, 'Linus the Barbarian', 'document name field does not' +
                                     ' match expected (update not performed)');
                    
                    cb();
                });
            });
        });

        describe('destroy', function() {
            
            it('should delete the document without errors', function(cb) {
                
                adapter.destroy(collection.identity, {where: {id: testDocID}}, function(err, result) {
                    
                    assert(!err, 'adapter.destroy returned an error: ' + err);
                    
                    cb();
                });
            });
        });

        describe('teardown', function() {
            
            it('should shutdown the connection without errors', function(cb) {
                
                adapter.teardown(collection.identity, function(err, result) {
                    
                    assert.deepEqual(result, 'connection terminated');
                    
                    cb();
                });
            });
        });
        
});
    