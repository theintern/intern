import { default as Test, TestDescriptor } from './Test';
import { InternError, Deferred } from '../interfaces';
import Benchmark = require('benchmark');
import Promise = require('dojo/Promise');
import * as lang from 'dojo/lang';
import * as string from 'dojo/string';

const createLifecycle = (function () {
	const template = [
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

	function createLifecycle(before: boolean) {
		return string.substitute(template, {
			queueName: before ? 'Before' : 'After',
			queueMethod: before ? 'push' : 'unshift',
			methodName: before ? 'before' : 'after'
		});
	}

	return createLifecycle;
})();

/* istanbul ignore next */
function noop() {}

function createDeferred(benchmark: Benchmark, deferred: Deferred<any>, numCallsUntilResolution?: number) {
	if (!numCallsUntilResolution) {
		numCallsUntilResolution = 1;
	}

	return {
		resolve() {
			--numCallsUntilResolution;
			if (numCallsUntilResolution === 0) {
				deferred.resolve();
			}
			else if (numCallsUntilResolution < 0) {
				throw new Error('resolve called too many times');
			}
		},

		reject(error: InternError) {
			benchmark.error = error;
			benchmark.abort();
			deferred.resolve();
		},

		progress: noop,

		rejectOnError(this: any, callback: Function) {
			const self = this;
			return function (this: any) {
				try {
					return callback.apply(this, arguments);
				}
				catch (error) {
					self.reject(error);
				}
			};
		},

		callback: function (this: any, callback: Function) {
			const self = this;
			return self.rejectOnError(function (this: any) {
				const returnValue = callback.apply(this, arguments);
				self.resolve();
				return returnValue;
			});
		}
	};
}

export interface BenchmarkTestFunction {
	(): void | Promise<any>;
	options?: BenchmarkOptions;
}

export interface BenchmarkDeferredTestFunction {
	(deferred: Deferred<any>): void | Promise<any>;
	options?: BenchmarkOptions;
}

export interface BenchmarkTestDescriptor extends TestDescriptor {
	test?: BenchmarkTestFunction;
}

export interface BenchmarkOptions extends Benchmark.Options {
	skip?: string;
	numCallsUntilResolution?: number;
}

export interface InternBenchmark extends Benchmark {
	internTest?: BenchmarkTest;
}

/**
 * A wrapper around a Benchmark.js Benchmark that maps its API to that used by Test.
 */
export default class BenchmarkTest extends Test {
	test: BenchmarkTestFunction;

	benchmark: InternBenchmark;

	constructor(descriptor: BenchmarkTestDescriptor) {
		// Call the superclass constructor with the set of descriptor keys not specific to BenchmarkTest
		let args: any = {};
		for (let key in descriptor) {
			switch (key) {
			case 'test':
			case 'options':
				break;
			default:
				args[key] = (<any> descriptor)[key];
			}
		}

		super(args);

		// `options`, if present, will be a property on the test function
		this.test = (descriptor && descriptor.test) || /* istanbul ignore next */ function () {};

		const self = this;

		const options: BenchmarkOptions = lang.mixin({}, this.test.options, {
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
					return function (this: BenchmarkTest, deferred?: Deferred<any>) {
						const dfd = createDeferred(this.benchmark, deferred,
							options.numCallsUntilResolution);
						testFunction.call(this, dfd);
					};
				})(this.test);
			}

			this.benchmark = new Benchmark(
				descriptor.name,
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
	}

	get error() {
		if (this.benchmark) {
			return this.benchmark.error;
		}
		return null;
	}

	get timeElapsed() {
		if (this.benchmark && this.benchmark.times) {
			return this.benchmark.times.elapsed;
		}
		return 0;
	}

	async(_timeout?: number, _numCallsUntilResolution?: number): Deferred<any> {
		throw new Error('Benchmark tests must be marked as asynchronous and use the deferred ' +
			'passed to them rather than call `this.async()`.');
	}

	skip(_message: string = '') {
		throw new Error('Benchmark tests must be marked as skipped rather than call `this.skip()`.');
	}

	run() {
		this.hasPassed = false;

		const benchmark = this.benchmark;

		return new Promise((resolve, reject, _progress, setCanceler) => {
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

			this._report('testStart').then(function () {
				benchmark.run();
			});
		}).finally(function () {
			// Stop listening for benchmark events once the test is finished
			benchmark.off();
		}).then(
			() => {
				this.hasPassed = true;

				return this._report('testPass', {
					times: this.benchmark.times,
					hz: this.benchmark.hz,
					stats: this.benchmark.stats
				});
			},
			(error) => {
				return this._report('testFail', error).then(function () {
					throw error;
				});
			}
		).finally(() => {
			return this._report('testEnd');
		});
	}

	private _report(eventName: string, ...args: any[]) {
		const reporterManager = this.reporterManager;
		if (reporterManager) {
			args = [ eventName, this ].concat(args);
			return reporterManager.emit.apply(reporterManager, args).catch(function () {});
		}
		else {
			return Promise.resolve();
		}
	}

	static async(testFunction: BenchmarkDeferredTestFunction, numCallsUntilResolution?: number) {
		testFunction.options = lang.mixin({}, testFunction.options, {
			defer: true,
			numCallsUntilResolution: numCallsUntilResolution
		});

		return testFunction;
	}

	static skip(testFunction: BenchmarkTestFunction, reason?: string) {
		if (reason == null) {
			reason = 'skipped';
		}

		testFunction.options = lang.mixin({}, testFunction.options, {
			skip: reason
		});

		return testFunction;
	}
}
