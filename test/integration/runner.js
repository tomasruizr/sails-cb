/**
 * Run integration tests
 *
 * Uses the `waterline-adapter-tests` module to
 * run mocha tests against the appropriate version
 * of Waterline.  Only the interfaces explicitly
 * declared in this adapter's `package.json` file
 * are tested. (e.g. `queryable`, `semantic`, etc.)
 */


/**
 * Module dependencies
 */

var util = require('util');
var mocha = require('mocha');
var log = new (require('captains-log'))();
var TestRunner = require('waterline-adapter-tests');
var Adapter = require('../../');
require('../debugHelper');



// Grab targeted interfaces from this adapter's `package.json` file:
var package = {};
var interfaces = [];
try {
    package = require('../../package.json');
    interfaces = package['waterlineAdapter'].interfaces;
}
catch (e) {
    throw new Error(
    '\n'+
    'Could not read supported interfaces from `waterlineAdapter.interfaces`'+'\n' +
    'in this adapter\'s `package.json` file ::' + '\n' +
    util.inspect(e)
    );
}





log.info('Testing `' + package.name + '`, a Sails/Waterline adapter.');
log.info('Running `waterline-adapter-tests` against ' + interfaces.length + ' interfaces...');
log.info('( ' + interfaces.join(', ') + ' )');
console.log();
log('Latest draft of Waterline adapter interface spec:');
log('http://links.sailsjs.org/docs/plugins/adapters/interfaces');
console.log();




/**
 * Integration Test Runner
 *
 * Uses the `waterline-adapter-tests` module to
 * run mocha tests against the specified interfaces
 * of the currently-implemented Waterline adapter API.
 */
new TestRunner({

    // Load the adapter module.
    adapter: Adapter,

    // Default adapter config to use.
    config: {
        schema: false,
        //Added to wait for all the n1ql response in order to pass the waterline integration tests.
        //Check more about consistency in the Couchbase N1QL Documentation.
        consistency:2,
        //Added to make adjusments for test time in order to pass the waterline integration tests.
        //Basically what is does is to force Order By Primary Key when no other criteria is present.
        testMode: true,
        //The Next one is Important to ensure the order by id works properly.
        idStrategy: 'increment' // will work all the times. Recommended to perform waterline integration tests.
        // idStrategy: 'uuid_v1' // will work almost all the time. (Once happened that it did not).
        // idStrategy: 'uuid_v4' // will work some times
    },

    // The set of adapter interfaces to test against.
    // (grabbed these from this adapter's package.json file above)
    interfaces: interfaces

    // Most databases implement 'semantic' and 'queryable'.
    //
    // As of Sails/Waterline v0.10, the 'associations' interface
    // is also available.  If you don't implement 'associations',
    // it will be polyfilled for you by Waterline core.  The core
    // implementation will always be used for cross-adapter / cross-connection
    // joins.
    //
    // In future versions of Sails/Waterline, 'queryable' may be also
    // be polyfilled by core.
    //
    // These polyfilled implementations can usually be further optimized at the
    // adapter level, since most databases provide optimizations for internal
    // operations.
    //
    // Full interface reference:
    // https://github.com/balderdashy/sails-docs/blob/master/adapter-specification.md
});
