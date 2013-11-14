define([ 'chai' ], function (chai) {
	return {
		/**
		 * AMD plugin API interface for easy loading of chai assertion interfaces.
		 */
		load: function (id, parentRequire, callback) {
			if (id && !chai[id]) {
				throw new Error('Invalid chai interface "' + id + '"');
			}

			if (id && !chai[id].AssertionError) {
				chai[id].AssertionError = chai.AssertionError;
			}

			callback(chai[id] || chai);
		}
	};
});
