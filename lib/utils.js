'use strict';
/**
 * descriprion
 *
 * @module utils
 * @main utils
 */
//*******************************************
//Dependencies
//*******************************************
var _ = require('lodash');
var moment = require('moment');
//*******************************************
// Constructor & Properties
//*******************************************

/**
 * [utils description]
 *
 * @class utils
 * 
 * @constructor
 */
var utils = {
//*******************************************
//Methods
//*******************************************
	prepareIds : function(ids, collection) {
		function validateId(id, collection) {
			if (typeof id !== 'string'){
	      id = id.toString();
	    }
	    if (id.startsWith(collection + '::') === false){
	      id = collection + '::' + id;
	    }
	    return id;
		}
		if (Array.isArray(ids)){
			return _.map(ids, function(id) {
				return validateId(id, collection);
			});
		} else {
			return validateId(ids, collection);
		}
		
	},
	isValidDate : function (str) {
		return moment(str, 'YYYY/MM/DD').isValid() || moment(str, 'YYYY-MM-DD').isValid();
	}
};
//*******************************************
// module export
//*******************************************
module.exports = utils;