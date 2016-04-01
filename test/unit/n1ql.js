'use strict';
var N1ql = require('../../lib/n1ql');
var _ = require('lodash');
require('../globals');

var n1ql;
before(function () {
		n1ql = new N1ql();
});

describe('n1ql.js', function () {
	describe('normalizeResponse', function () {
		it('should return an object with id and the value in the same response.', function() {
				var response = {
					id:'myid',
					person: {
						name: 'tomas',
						lastname:'ruiz'
					}
				};
				var res = n1ql.normalizeResponse(response);
				expect(typeof res === 'object').to.be.true;
				assert(res.id);
				assert(res.id ==='myid');
				assert(res.name);
				assert(res.name==='tomas');
				assert(res.lastname);
				assert(res.lastname==='ruiz');
		});
		it('should return an array of object with id and the value in the same response.', function() {
				var response = [
					{
						id:'myid',
						person: {
							name: 'tomas',
							lastname:'ruiz',
							nested: {
								field1: 'field1',
								field2: 'field2'
							}
						}
					},
					{
						id:'myid2',
						person: {
							name: 'tomas2',
							lastname:'ruiz2',
							nested: {
								field1: 'field1',
								field2: 'field2'
							}
						}
					}
				];
				var res = n1ql.normalizeResponse(response);
				_.each(res, function(item) {
					assert(typeof item === 'object');
					assert(item.id);
					assert(item.name);
					assert(item.lastname);
					assert(item.nested.field1 === 'field1');
				});
		});
		it('should cast the date type og the objects', function() {
				var response = {
						id:'myid',
						person: {
							name: 'tomas',
							lastname:'ruiz',
							datetime:{
								date: '11/11/11',
								time: '17:50',
								time2: '8:00am'
							}
						}
					};
				var res = n1ql.normalizeResponse(response);
				assert(typeof res === 'object');
				assert(res.datetime);
				assert(res.datetime.date instanceof Date);
		});
	});
	describe('where', function () {
		it('should return a where string with a single condition', function() {
			var res = n1ql.where({name:'Tomas'});
			expect(res).to.equal(' WHERE name = "Tomas"');
		});
		it('should include the selection only of the document type', function() {
			var res = n1ql.where({name:'Tomas'}, 'person');
			expect(res).to.equal(' WHERE name = "Tomas" AND META(person).id LIKE "person::%"');
		});
		it('should return a where string with a multiple condition', function() {
			var res = n1ql.where({name:'Tomas', 'lastName':'Ruiz'});
			expect(res).to.equal(' WHERE name = "Tomas" AND lastName = "Ruiz"');
		});
		it('should return a where string with a multiple condition only for document type', function() {
			var res = n1ql.where({name:'Tomas', 'lastName':'Ruiz'}, 'person');
			expect(res).to.equal(' WHERE name = "Tomas" AND lastName = "Ruiz" AND META(person).id LIKE "person::%"');
		});
	});
	describe('buildSelect', function () {
		it('should return a select', function() {
			var res = n1ql.buildSelect('person', 'default');
			expect(res).to.equal('SELECT *, META(person).id FROM default person');
		});
	});
	describe('prepareValue', function () {
		it('should prepare values to be used in the where clause', function () {
			assert.equal(n1ql.prepareValue('Hola'),'"Hola"');
			var d = new Date();
			assert.equal(n1ql.prepareValue(d), n1ql.toStringDate(d));
			assert.equal(n1ql.prepareValue(3),3);
			assert.equal(n1ql.prepareValue(['hola', 23, 'asdf']),'"hola",23,"asdf"');
		});
	});
	describe('prepareWhereValue', function () {
		it('should prepare the values for a Where clause', function () {
			
			//null and missing
			assert.equal(n1ql.prepareWhereValue('!', null, 'someAttr'), 'someAttr IS NOT NULL');
			assert.equal(n1ql.prepareWhereValue('!', 'missing', 'someAttr'), 'someAttr IS NOT MISSING');
			assert.equal(n1ql.prepareWhereValue('=', null, 'someAttr'), 'someAttr IS NULL');
			assert.equal(n1ql.prepareWhereValue('=', 'missing', 'someAttr'), 'someAttr IS MISSING');

			//string test
			assert.equal(n1ql.prepareWhereValue('<', 'TAL', 'someAttr'), 'someAttr<"TAL"');
			assert.equal(n1ql.prepareWhereValue('lessThan', 'TAL', 'someAttr'), 'someAttr<"TAL"');
			assert.equal(n1ql.prepareWhereValue('<=', 'TAL', 'someAttr'), 'someAttr<="TAL"');
			assert.equal(n1ql.prepareWhereValue('lessThanOrEqual', 'TAL', 'someAttr'), 'someAttr<="TAL"');
			assert.equal(n1ql.prepareWhereValue('>', 'TAL', 'someAttr'), 'someAttr>"TAL"');
			assert.equal(n1ql.prepareWhereValue('greaterThan', 'TAL', 'someAttr'), 'someAttr>"TAL"');
			assert.equal(n1ql.prepareWhereValue('>=', 'TAL', 'someAttr'), 'someAttr>="TAL"');
			assert.equal(n1ql.prepareWhereValue('greaterThanOrEqual', 'TAL', 'someAttr'), 'someAttr>="TAL"');
			assert.equal(n1ql.prepareWhereValue('!', 'TAL', 'someAttr'), 'someAttr<>"TAL"');
			assert.equal(n1ql.prepareWhereValue('not', 'TAL', 'someAttr'), 'someAttr<>"TAL"');
			assert.equal(n1ql.prepareWhereValue('like', 'TAL', 'someAttr'), 'someAttr LIKE "TAL"');
			assert.equal(n1ql.prepareWhereValue('contains', 'TAL', 'someAttr'), 'someAttr LIKE "%TAL%"');
			assert.equal(n1ql.prepareWhereValue('startsWith', 'TAL', 'someAttr'), 'someAttr LIKE "TAL%"');
			assert.equal(n1ql.prepareWhereValue('endsWith', 'TAL', 'someAttr'), 'someAttr LIKE "%TAL"');
			assert.equal(n1ql.prepareWhereValue('=', 'TAL', 'someAttr'), 'someAttr = "TAL"');

			//integer tests
			assert.equal(n1ql.prepareWhereValue('<', 3, 'someAttr'), 'someAttr<3');
			assert.equal(n1ql.prepareWhereValue('lessThan', 3, 'someAttr'), 'someAttr<3');
			assert.equal(n1ql.prepareWhereValue('<=', 3, 'someAttr'), 'someAttr<=3');
			assert.equal(n1ql.prepareWhereValue('lessThanOrEqual', 3, 'someAttr'), 'someAttr<=3');
			assert.equal(n1ql.prepareWhereValue('>', 3, 'someAttr'), 'someAttr>3');
			assert.equal(n1ql.prepareWhereValue('greaterThan', 3, 'someAttr'), 'someAttr>3');
			assert.equal(n1ql.prepareWhereValue('>=', 3, 'someAttr'), 'someAttr>=3');
			assert.equal(n1ql.prepareWhereValue('greaterThanOrEqual', 3, 'someAttr'), 'someAttr>=3');
			assert.equal(n1ql.prepareWhereValue('!', 3, 'someAttr'), 'someAttr<>3');
			assert.equal(n1ql.prepareWhereValue('not', 3, 'someAttr'), 'someAttr<>3');
			assert.equal(n1ql.prepareWhereValue('=', 3, 'someAttr'), 'someAttr = 3');

			
			// arrays
			assert.equal(n1ql.prepareWhereValue('IN', ['asdf', 'asdfdwd'], 'someAttr'), '(someAttr IN ["asdf","asdfdwd"])');
		});
	});
});