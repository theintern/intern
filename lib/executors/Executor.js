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
		 * True if reporters have been loaded into reporterManager.
		 *
		 * @type {boolean}
		 */
		reportersReady: false,

		/**
		 * The root suites managed by this executor.
		 *
		 * @type {Suite[]}
		 */
		suites: null,

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

				has('host-browser') && util.assertSafeModuleId(id);

				return id;
			});

			var reporterManager = this.reporterManager;
			var self = this;

			return new Promise(function (resolve, reject) {
				require(reporterModuleIds, function () {
					try {
						for (var i = 0, Reporter; (Reporter = arguments[i]); ++i) {
							var kwArgs = reporters[i];

							// reporter was simply specified as a string
							if (typeof kwArgs === 'string') {
								kwArgs = {};
							}

							// pass each reporter the full intern config as well as its own options
							kwArgs.intern = self.config;
							reporterManager.add(Reporter, kwArgs);
						}

						resolve(reporterManager.emit('start').then(function () {
							self.reportersReady = true;
						}));
					}
					catch (error) {
						reject(error);
					}
				});
			});
		},

		/**
		 * Loads test modules, which register suites for testing within the test system.
		 *
		 * @param {Suite[]} rootSuites The suites upon which tests from the test modules should be registered.
		 * @param {string[]} moduleIds The IDs of the test modules to load.
		 * @return {Promise.<void>}
		 */
		_loadTestModules: function (moduleIds) {
			if (has('host-browser')) {
				moduleIds.forEach(util.assertSafeModuleId);
			}

			return new Promise(function (resolve, reject) {
				require(moduleIds, function () {
					// resolve should receive no arguments
					resolve();
				}, reject);
			});
		},

		/**
		 * Register tests on the root suites.
		 */
		register: function (callback) {
			this.suites.forEach(callback);
		},

		/**
		 * Sets up the environment for test execution with instrumentation, reporting, and error handling. Subclasses
		 * must override this method to actually run tests.
		 *
		 * @returns {Promise.<void>}
		 */
		run: function () {
			var self = intern.executor = this;
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

			return reporterManager.emit('runStart', this)
				.then(function () {
					return runTests();
				})
				.finally(function (result) {
					/* global __internCoverage:false */
					typeof __internCoverage !== 'undefined' && reporterManager.emit('coverage', null, __internCoverage);

					if (result instanceof Error) {
						throw result;
					}
					else {
						return result;
					}
				})
				.then(
					function (result) {
						return reporterManager.emit('runEnd', self).then(function () {
							return result;
						});
					},
					function (error) {
						return reporterManager.emit('fatalError', error).then(function () {
							throw error;
						});
					}
				)
				.then(
					function (numFailedTests) {
						if (config.after) {
							return config.after(self, numFailedTests).then(function (returnValue) {
								return returnValue === undefined ? numFailedTests : returnValue;
							});
						}

						return numFailedTests;
					},
					function (error) {
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
					}
				);
		}
	};

	return Executor;
});
