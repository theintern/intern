define([ 'chai' ], function (chai) {
	return {
		/**
		 * AMD plugin API interface for easy loading of chai assertion interfaces.
		 */
		load: function (id, parentRequire, callback) {
			callback(chai[id]);
		}
	};
});