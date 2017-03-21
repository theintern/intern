/**
 * A wrapper around a Benchmark.js Benchmark that maps its API to that used by Test.
 */
define([
	'./Test',
	'benchmark',
	'dojo/Promise',
	'dojo/lang',
	'dojo/string'
], function (
	Test,
	Benchmark,
	Promise,
	lang,
	string
) {
	var createLifecycle = (function () {
		var template = [
			'(function (benchmark) {',
				'\tvar queue = benchmark.intern${queueName}EachLoopQueue;',
				'\tvar suite;',
				'\tif (!queue) {',
					'\t\tsuite = benchmark.internTest;',
					'\t\tbenchmark.intern${queueName}EachLoopQueue = queue = [];',
					'\t\twhile ((suite = suite.parent)) {',
						'\t\t\tif (suite.${methodName}EachLoop) {',
							'\t\t\tqueue.${queueMethod}(suite);',
						'\t\t\t}',
					'\t\t}',
				'\t}',
				'\tvar i = queue.length;',
				'\twhile((suite = queue[--i])) {',
					'\t\tsuite.${methodName}EachLoop();',
				'\t}',
			'})(this.benchmark || this);\n'
		].join('\n');

		function createLifecycle(before) {
			return string.substitute(template, {
				queueName: before ? 'Before' : 'After',
				queueMethod: before ? 'push' : 'unshift',
				methodName: before ? 'before' : 'after'
			});
		}
		return createLifecycle;
	})();

	function BenchmarkTest(kwArgs) {
		// `options`, if present, will be a property on the test function
		this.test = (kwArgs && kwArgs.test) || /* istanbul ignore next */ function () {};
		var self = this;
		var options = lang.mixin({}, this.test.options, {
			async: true,
			setup: createLifecycle(true),
			teardown: createLifecycle(false)
		});

		if ('skip' in options) {
			this.skipped = options.skip;
		}
		else {
			if (options.defer) {
				this.test = (function (testFunction) {
					return function (deferred) {
						var dfd = createDeferred(this.benchmark, deferred, options.numCallsUntilResolution);
						testFunction.call(this, dfd);
					};
				})(this.test);
			}

			this.benchmark = new Benchmark(
				kwArgs.name,
				options.defer ?
					'this.benchmark.internTest.test.call(this.benchmark.internTest, deferred);' :
					'this.internTest.test.call(this.internTest);',
				options
			); 

			Object.defineProperty(this.benchmark, 'name', {
				get: function () {
					return self.name;
				},
				set: function (name) {
					self.name = name;
				}
			});

			this.benchmark.internTest = this;
		}

		// Call the superclass constructor with the set of kwArgs not specific to BenchmarkTest
		var args = {};
		for (var key in kwArgs) {
			switch (key) {
			case 'test':
			case 'options':
				break;
			default:
				args[key] = kwArgs[key];
			}
		}
		Test.call(this, args);
	}

	BenchmarkTest.prototype = Object.create(Test.prototype, {
		constructor: { value: BenchmarkTest },

		error: {
			get: function () {
				if (this.benchmark) {
					return this.benchmark.error;
				}
				return null;
			}
		},

		timeElapsed: {
			get: function () {
				if (this.benchmark && this.benchmark.times) {
					return this.benchmark.times.elapsed;
				}
				return 0;
			}
		},

		async: {
			value: function () {
				throw new Error('Benchmark tests must be marked as asynchronous and use the deferred passed to them rather than call `this.async()`.');
			}
		},

		skip: {
			value: function () {
				throw new Error('Benchmark tests must be marked as skipped rather than call `this.skip()`.');
			}
		},

		run: {
			value: function () {
				function report(eventName) {
					if (reporterManager) {
						var args = [ eventName, self ].concat(Array.prototype.slice.call(arguments, 1));
						return reporterManager.emit.apply(reporterManager, args).catch(function () {});
					}
					else {
						return Promise.resolve();
					}
				}

				var reporterManager = this.reporterManager;

				this.hasPassed = false;

				var self = this;
				var benchmark = this.benchmark;

				return new Promise(function (resolve, reject, progress, setCanceler) {
					setCanceler(function (reason) {
						benchmark.error = reason;
						benchmark.abort();

						throw reason;
					});

					benchmark.on('abort', function () {
						reject(benchmark.error);
					});

					benchmark.on('error', function () {
						reject(benchmark.error);
					});

					benchmark.on('complete', function () {
						resolve();
					});

					report('testStart').then(function () {
						benchmark.run();
					});
				}).finally(function () {
					// Stop listening for benchmark events once the test is finished
					benchmark.off();
				}).then(function () {
					self.hasPassed = true;

					return report('testPass', {
						times: self.benchmark.times,
						hz: self.benchmark.hz,
						stats: self.benchmark.stats
					});
				}, function (error) {
					return report('testFail', error).then(function () {
						throw error;
					});
				}).finally(function () {
					return report('testEnd');
				});
			}
		}
	});

	/* istanbul ignore next */
	function noop() {}

	function createDeferred(benchmark, deferred, numCallsUntilResolution) {
		if (!numCallsUntilResolution) {
			numCallsUntilResolution = 1;
		}

		return {
			resolve: function () {
				--numCallsUntilResolution;
				if (numCallsUntilResolution === 0) {
					deferred.resolve();
				}
				else if (numCallsUntilResolution < 0) {
					throw new Error('resolve called too many times');
				}
			},

			reject: function (error) {
				benchmark.error = error;
				benchmark.abort();
				deferred.resolve();
			},

			progress: noop,

			rejectOnError: function (callback) {
				var self = this;
				return function () {
					try {
						return callback.apply(this, arguments);
					}
					catch (error) {
						self.reject(error);
					}
				};
			},

			callback: function (callback) {
				var self = this;
				return self.rejectOnError(function () {
					var returnValue = callback.apply(this, arguments);
					self.resolve();
					return returnValue;
				});
			}
		};
	}

	BenchmarkTest.async = function (testFunction, numCallsUntilResolution) {
		testFunction.options = lang.mixin({}, testFunction.options, {
			defer: true,
			numCallsUntilResolution: numCallsUntilResolution
		});

		return testFunction;
	};

	BenchmarkTest.skip = function (testFunction, reason) {
		if (reason == null) {
			reason = 'skipped';
		}

		testFunction.options = lang.mixin({}, testFunction.options, {
			skip: reason
		});

		return testFunction;
	};

	return BenchmarkTest;
});
