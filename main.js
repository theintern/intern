define([
	'require'
], function (require) {
	return {
		/**
		 * The executor for the current test run.
		 */
		executor: null,

		/**
		 * AMD plugin API interface for easy loading of test interfaces.
		 */
		load: function (id, parentRequire, callback) {
			require([ './lib/interfaces/' + id ], callback);
		}
	};
});
