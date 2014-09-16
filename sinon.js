define([
	'sinon',
], function (sinon) {
	console.log('loaded sinon:', sinon);
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
