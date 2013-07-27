define([
	'require',
	'dojo/Deferred',
	'./lib/util'
], function (require, Deferred, util) {
	return {
		/**
		 * Maximum number of suites to run concurrently. Currently used only by the server-side runner.
		 */
		maxConcurrency: Infinity,

		/**
		 * Suites to run. Each suite defined here corresponds to a single environment.
		 */
		suites: [],

		/**
		 * Runs all environmental suites concurrently, with a concurrency limit.
		 */
		run: function () {
			var dfd = new Deferred(),
				queue = util.createQueue(this.maxConcurrency),
				numSuitesCompleted = 0,
				numSuitesToRun = this.suites.length;

			this.suites.forEach(queue(function (suite) {
				return suite.run().always(function () {
					if (++numSuitesCompleted === numSuitesToRun) {
						dfd.resolve();
					}
					else {
						console.log('%d environments left to test', numSuitesToRun - numSuitesCompleted);
					}
				});
			}));

			return dfd.promise;
		},

		/**
		 * AMD plugin API interface for easy loading of test interfaces.
		 */
		load: function (id, parentRequire, callback) {
			require([ './lib/interfaces/' + id ], callback);
		}
	};
});
