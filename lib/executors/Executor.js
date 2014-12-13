define([
	'dojo/has',
	'dojo/lang',
	'dojo/Promise',
	'../../main',
	'../ReporterManager',
	'../util',
	'require'
], function (
	has,
	lang,
	Promise,
	intern,
	ReporterManager,
	util,
	require
) {
	function Executor(config, global) {
		this.config = lang.deepDelegate(this.config, config);
		this.reporterManager = new ReporterManager();
		this.global = global;
	}

	Executor.prototype = {
		constructor: Executor,

		/**
		 * The resolved configuration for this executor.
		 *
		 * @type {Object}
		 */
		config: {},

		/**
		 * @type {module:intern/lib/executors/PreExecutor}
		 */
		global: null,

		/**
		 * The type of the executor.
		 *
		 * @type {string}
		 */
		mode: null,

		/**
		 * The reporter manager for this test execution.
		 *
		 * @type {ReporterManager}
		 */
		reporterManager: null,

		/**
		 * Enables instrumentation for all code loaded into the current environment.
		 *
		 * @param {string} basePath The base path to use to calculate absolute paths for use by lcov.
		 * @param {RegExp} excludePaths A regular expression matching paths, relative to `basePath`, that should not be
		 * instrumented.
		 * @returns {Handle} Remove handle.
		 */
		enableInstrumentation: function (basePath, excludePaths) {
			if (has('host-node')) {
				return util.setInstrumentationHooks(excludePaths, basePath);
			}
		},

		/**
		 * The error handler for fatal errors (uncaught exceptions and errors within the test system itself).
		 *
		 * @param {Error} error
		 */
		_handleError: function (error) {
			this.reporterManager.emit('fatalError', error);
		},

		/**
		 * Loads reporters into the reporter manager.
		 *
		 * @param {(Object|string)[]} reporters An array of reporter configuration objects.
		 * @returns {Promise.<void>}
		 */
		_loadReporters: function (reporters) {
			var reporterModuleIds = reporters.map(function (reporter) {
				var id;

				if (typeof reporter === 'string') {
					id = reporter;
				}
				else {
					id = reporter.constructor;
				}

				if (id.indexOf('/') === -1) {
					id = require.toAbsMid('../reporters/' + id);
				}

				return id;
			});

			var reporterManager = this.reporterManager;

			return new Promise(function (resolve, reject) {
				require(reporterModuleIds, function () {
					try {
						for (var i = 0, Reporter; (Reporter = arguments[i]); ++i) {
							var kwArgs = reporters[i];

							// reporter was simply specified as a string
							if (typeof kwArgs === 'string') {
								kwArgs = {};
							}

							reporterManager.add(Reporter, kwArgs);
						}

						resolve(reporterManager.emit('run').then(function () {}));
					}
					catch (error) {
						reject(error);
					}
				}, reject);
			});
		},

		/**
		 * Loads test modules, which register suites for testing within the test system.
		 *
		 * @param {Suite[]} rootSuites The suites upon which tests from the test modules should be registered.
		 * @param {string[]} moduleIds The IDs of the test modules to load.
		 * @return {Promise.<void>}
		 */
		_loadTestModules: function (rootSuites, moduleIds) {
			intern.register = function (callback) {
				rootSuites.forEach(callback);
			};

			return new Promise(function (resolve, reject) {
				require(moduleIds, function () {
					// resolve should receive no arguments
					resolve();
				}, reject);
			});
		},

		/**
		 * Sets up the environment for test execution with instrumentation, reporting, and error handling. Subclasses
		 * must override this method to actually run tests.
		 *
		 * @returns {Promise.<void>}
		 */
		run: function () {
			var self = this;
			var config = this.config;

			return Promise.resolve()
				.then(lang.bind(this, 'enableInstrumentation', config.basePath, config.excludeInstrumentation))
				.then(lang.bind(this, '_loadReporters', config.reporters))
				.then(lang.bind(this.global, 'registerErrorHandler', lang.bind(this, '_handleError')))
				.then(function () {
					return config.before && config.before(self);
				});
		},

		/**
		 * A convenenience wrapper for a test running function that handles emitting start/end events, collecting
		 * coverage data, and converting test runs with failed tests into failed test runs.
		 *
		 * @param {Function} runTests A function that actually runs the tests.
		 * @returns {Promise.<void>}
		 */
		_runTests: function (runTests) {
			var self = this;
			var config = this.config;
			var reporterManager = this.reporterManager;

			return reporterManager.emit('start')
				.then(function () {
					runTests();
				})
				.always(function (error) {
					/* global __internCoverage:false */
					typeof __internCoverage !== 'undefined' && reporterManager.emit('coverage', __internCoverage);

					if (error instanceof Error) {
						throw error;
					}
				})
				.then(
					lang.bind(reporterManager, 'emit', 'end'),
					function (error) {
						return reporterManager.emit('fatalError', error).then(function () {
							throw error;
						});
					}
				)
				.then(function (numFailedTests) {
					if (config.after) {
						return config.after(self, numFailedTests).then(function (returnValue) {
							return returnValue === undefined ? numFailedTests : returnValue;
						});
					}

					return numFailedTests;
				}, function (error) {
					if (config.after) {
						return config.after(self, error).then(function (returnValue) {
							if (returnValue === undefined) {
								throw error;
							}
							else {
								return returnValue;
							}
						});
					}

					throw error;
				})
				.then(function (numFailedTests) {
					if (numFailedTests) {
						throw new Error(numFailedTests + ' tests failed');
					}
				});
		}
	};

	return Executor;
});
