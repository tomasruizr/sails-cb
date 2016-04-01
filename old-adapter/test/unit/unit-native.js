var waterline = require('waterline'),
    assert = require('assert'),
    _ = require('underscore'),
    adapter = require('../lib/adapter.js');

    

describe('collection', function() {
        
        var newGearID,
            newSpringID,
            GearModel,
            SpringModel,
            Gear = { },
            Spring = { };
        
                
        GearModel = waterline.Collection.extend({
            
            tableName: 'gears',
            
            adapter: 'couchbase',
        
            attributes: {
                type: 'string',
                size: 'string',
                gears: 'integer'
            }
        });
        
        SpringModel = waterline.Collection.extend({
            
            tableName: 'springs',
            
            adapter: 'couchbase',
            
            updateConcurrency: 'pessimistic',
        
            attributes: {
                material: 'string',
                length: 'string',
                windings: 'integer'
            }
        });
        
        before(function(cb) {
            
            new GearModel({ adapters: { couchbase: adapter }}, function(err, gear) {
                
                Gear = gear;
                
                
                
                new SpringModel({ adapters: { couchbase: adapter }}, function(err, spring) {
                    
                    Spring = spring;
                    
                    cb();
                });

            });
            
        });
    
        
        describe('.create()', function() {
            
            it('should create a new object in the database without errors', function(cb) {
                
                Gear.create({
                    type: 'planetary',
                    size: '2m',
                    gears: 12
                }).done(function(err, gear) {
                    
                    assert(!err, '.create() returned an error: ' + err);
                    
                    newGearID = gear.id;
                    
                    cb();
                });
            });

            it('should create a second new object in the database without errors', function(cb) {
                
                Spring.create({
                    material: 'unobtainium',
                    length: '10cm',
                    windings: 64
                }).done(function(err, spring) {
                    
                    assert(!err, '.create() returned an error: ' + err);
                    
                    newSpringID = spring.id;
                    
                    cb();
                });
            });

        });
        
        describe('.findOne()', function() {
            
            it('should retrieve a new object from the database without errors', function(cb) {
                
                Gear.findOne(newGearID).done(function(err, gear) {
                    
                    assert(!err, '.findOne() returned an error: ' + err);
                    
                    //Overwrite the main widget object to perform a save in the next 'describe'
                    Gear = gear;
                    
                    cb();
                });
            });
            
            it('should retrieve a second new object from the database without errors', function(cb) {
                
                Spring.findOne(newSpringID).done(function(err, spring) {
                    
                    assert(!err, '.findOne() returned an error: ' + err);
                    
                    //Overwrite the main widget object to perform a save in the next 'describe'
                    Spring = spring;
                    
                    cb();
                });
            });
        });
        
        describe('.save()', function() {
            
            it('should save a change to the object without errors', function(cb) {
                
                Gear.size = '4m';
                
                Gear.save(function(err) {
                    
                    assert(!err, '.save() returned an error: ' + err);
                });
                
                cb();
            });
            
            it('should save a change to the second object without errors', function(cb) {
                
                Spring.windings = 32;
                
                Spring.save(function(err) {
                    
                    assert(!err, '.save() returned an error: ' + err);
                });
                
                cb();
            });
            
        }); 
        
        describe('.destroy()', function() {
            
            it('should destroy the first object without errors', function(cb) {
                
                Gear.destroy(function(err) {
                    
                    assert(!err, '.destroy() returned an error: ' + err);
                    
                    cb();
                });
                
            });
            
            it('should destroy the second object without errors', function(cb) {
                
                Spring.destroy(function(err) {
                    
                    assert(!err, '.destroy() returned an error: ' + err);
                    
                    cb();
                });
                
            });
        });
    
        
});
    