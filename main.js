define([
	'require',
	'dojo/Deferred',
	'./lib/args',
	'./lib/util'
], function (require, Deferred, args, util) {
	return {
		/**
		 * The mode in which Intern is currently running. Either 'client' or 'runner'.
		 */
		mode: null,

		/**
		 * The arguments received from the environment for the current test run.
		 */
		args: args,

		/**
		 * The configuration data in use for the current test run.
		 */
		config: null,

		/**
		 * Maximum number of suites to run concurrently. Currently used only by the server-side runner.
		 */
		maxConcurrency: Infinity,

		/**
		 * Suites to run. Each suite defined here corresponds to a single environment.
		 */
		suites: [],

		/**
		 * The tunnel for the current Selenium provider.
		 */
		tunnel: null,

		/*
		 * A regular expression that will be used to filter tests. Only tests with IDs matching the expression will be
		 * executed. By default, all tests will be executed.
		 */
		grep: /.*/,

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
