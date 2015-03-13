define([
	'require'
], function (require) {
	return {
		/**
		 * The arguments Intern was started with, post-processing (e.g.,
		 * repeated arguments are converted to arrays).
		 */
		args: null,

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
