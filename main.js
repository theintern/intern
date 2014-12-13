define([
	'require'
], function (require) {
	return {
		/**
		 * Registers a test with the test system. Executors are responsible for replacing this method prior to
		 */
		register: function () {
			throw new Error('Attempt to register tests too early');
		},

		/**
		 * AMD plugin API interface for easy loading of test interfaces.
		 */
		load: function (id, parentRequire, callback) {
			require([ './lib/interfaces/' + id ], callback);
		}
	};
});
