define([
	'sinon',
	'require',
	'sinon/assert',
	'sinon/behavior',
	'sinon/call',
	'sinon/collection',
	'sinon/match',
	'sinon/spy',
	'sinon/sandbox',
	'sinon/stub',
	'sinon/test',
	'sinon/test_case'
], function (sinon, require) {
	return {
		/**
		 * AMD plugin API interface for easy loading of sinon interfaces.
		 */
		load: function (id, parentRequire, callback) {
			if (id === 'call') {
				id = 'spyCall';
			}

			// mock uses spy properties during its initialization, so we have to load it after spy
			require([ 'sinon/mock' ], function () {
				callback(id ? sinon[id] : sinon);
			});
		}
	};
});
