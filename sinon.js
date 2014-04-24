define([
	'sinon',
	// need to use intern/order to handle inter-dependencies in sinon modules
	'intern/order!sinon/assert',
	'intern/order!sinon/behavior',
	'intern/order!sinon/call',
	'intern/order!sinon/collection',
	'intern/order!sinon/match',
	'intern/order!sinon/spy',
	'intern/order!sinon/mock',
	'intern/order!sinon/sandbox',
	'intern/order!sinon/stub',
	'intern/order!sinon/test',
	'intern/order!sinon/test_case'
], function (sinon) {
	return {
		/**
		 * AMD plugin API interface for easy loading of sinon interfaces.
		 */
		load: function (id, parentRequire, callback) {
			if (id === 'call') {
				id = 'spyCall';
			}

			callback(id ? sinon[id] : sinon);
		}
	};
});
