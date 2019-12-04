// Explicitly require benchmark dependencies and attach Benchmark to them to
// improve WebPack compatibility
import _ from 'lodash';
import * as platform from 'platform';
import Benchmark from 'benchmark';

import { Task, CancellablePromise } from '../../common';
import Test, {
  isTest,
  SKIP,
  TestFunction,
  TestOptions,
  TestProperties
} from './Test';
import { InternError } from './types';
import Deferred from './Deferred';

// TODO: remove the <any> cast when benchmark typings are updated to include
// runInContext
(<any>Benchmark).runInContext({ _, platform });

/**
 * BenchmarkTest wraps a Benchmark.js Benchmark, mapping its API to that used by
 * [[lib/Test]].
 */
export default class BenchmarkTest extends Test {
  /** The test function managed by this test */
  test!: BenchmarkTestFunction;

  /** The Benchmark.js test that actually performs benchmarking */
  benchmark: InternBenchmark;

  constructor(descriptor: BenchmarkTestOptions) {
    // Call the superclass constructor with the set of descriptor keys not
    // specific to BenchmarkTest
    let args: { [key: string]: any } = {};
    Object.keys(descriptor).forEach(descriptorKey => {
      const key = <keyof BenchmarkTestOptions>descriptorKey;
      if (key !== 'options') {
        args[key] = descriptor[key];
      }
    });

    const testArgs = args as TestOptions;
    testArgs.test = testArgs.test || /* istanbul ignore next */ function() {};

    super(testArgs);

    const options: BenchmarkOptions = Object.assign(
      {},
      this.test.options || {},
      {
        async: true,
        setup: createLifecycle(true),
        teardown: createLifecycle(false)
      }
    );

    if (options.defer) {
      this.test = (function(testFunction: BenchmarkTestFunction) {
        return <BenchmarkDeferredTestFunction>(
          function(this: BenchmarkTest, deferred?: Deferred<any>) {
            // deferred is optional for compat with
            // BenchmarkTestFunction, but it will always be defined here
            const dfd = createDeferred(
              this.benchmark,
              deferred!,
              options.numCallsUntilResolution
            );
            testFunction.call<BenchmarkTest, Deferred<void>[], void>(this, dfd);
          }
        );
      })(this.test);
    }

    this.benchmark = new Benchmark(
      descriptor.name,
      options.defer
        ? 'this.benchmark.internTest.test(deferred);'
        : 'this.internTest.test();',
      options
    );

    Object.defineProperty(this.benchmark, 'name', {
      get: () => {
        return this.name;
      },
      set: name => {
        this.name = name;
      }
    });

    this.benchmark.internTest = this;
  }

  /**
   * The number of milliseconds the test function took to complete.
   */
  get timeElapsed() {
    if (this.benchmark && this.benchmark.times) {
      return this.benchmark.times.elapsed;
    }
    return 0;
  }

  set timeElapsed(_value: number) {
    // ignore
  }

  async(_timeout?: number, _numCallsUntilResolution?: number): Deferred<any> {
    throw new Error(
      'Benchmark tests must be marked as asynchronous and use the deferred ' +
        'passed to them rather than call `this.async()`.'
    );
  }

  run(): CancellablePromise<void> {
    this._hasPassed = false;
    this._usesRemote = false;

    const benchmark = this.benchmark;

    return new Task(
      (resolve, reject) => {
        benchmark.on('abort', () => {
          reject(benchmark.error);
        });

        benchmark.on('error', () => {
          if (benchmark.error === SKIP) {
            resolve();
          } else {
            reject(benchmark.error);
          }
        });

        benchmark.on('complete', () => {
          resolve();
        });

        this.executor.emit('testStart', this).then(() => {
          benchmark.run();
        });
      },
      () => {
        benchmark.abort();
      }
    )
      .finally(() => {
        // Stop listening for benchmark events once the test is finished
        benchmark.off();
      })
      .then(
        () => {
          this._hasPassed = true;
        },
        error => {
          this.error = error;
          throw error;
        }
      )
      .finally(() => this.executor.emit('testEnd', this));
  }

  toJSON() {
    const json = super.toJSON();
    const benchmark = this.benchmark;

    json.benchmark = {
      hz: benchmark.hz,
      times: benchmark.times,
      stats: benchmark.stats
    };

    return json;
  }

  static async(
    testFunction: BenchmarkDeferredTestFunction,
    numCallsUntilResolution?: number
  ) {
    testFunction.options = Object.assign({}, testFunction.options || {}, {
      defer: true,
      numCallsUntilResolution: numCallsUntilResolution
    });

    return <BenchmarkTestFunction>testFunction;
  }
}

export interface BenchmarkTestFunction extends TestFunction {
  (this: BenchmarkTest): void | Promise<any>;
  options?: BenchmarkOptions;
}

export interface BenchmarkDeferredTestFunction extends BenchmarkTestFunction {
  (this: BenchmarkTest, deferred: Deferred<void>): void | Promise<any>;
  options?: BenchmarkOptions;
}

export interface BenchmarkTestProperties extends TestProperties {
  test: BenchmarkTestFunction;
  skip: string;
  numCallsUntilResolution: number;
}

export type BenchmarkTestOptions = Partial<BenchmarkTestProperties> & {
  name: string;
  test: BenchmarkTestFunction;
  options?: BenchmarkOptions;
};

export interface BenchmarkOptions extends Benchmark.Options {
  skip?: string;
  numCallsUntilResolution?: number;
}

export interface InternBenchmark extends Benchmark {
  internTest?: BenchmarkTest;
}

export function isBenchmarkTest(value: any): value is BenchmarkTest {
  return value && value.benchmark != null && isTest(value);
}

const createLifecycle = (before: boolean) => {
  const queueName = before ? 'Before' : 'After';
  const queueMethod = before ? 'push' : 'unshift';
  const methodName = before ? 'before' : 'after';
  return [
    '(function (benchmark) {',
    `	var queue = benchmark.intern${queueName}EachLoopQueue;`,
    '	var suite;',
    '	if (!queue) {',
    '		suite = benchmark.internTest;',
    `		benchmark.intern${queueName}EachLoopQueue = queue = [];`,
    '		while ((suite = suite.parent)) {',
    `			if (suite.${methodName}EachLoop) {`,
    `				queue.${queueMethod}(suite);`,
    '			}',
    '		}',
    '	}',
    '	var i = queue.length;',
    '	while((suite = queue[--i])) {',
    `		suite.${methodName}EachLoop();`,
    '	}',
    '})(this.benchmark || this);\n'
  ].join('\n');
};

function createDeferred(
  benchmark: Benchmark,
  deferred: Deferred<any>,
  numCallsUntilResolution?: number
) {
  let remainingCalls = numCallsUntilResolution || 1;

  return {
    resolve() {
      --remainingCalls;
      if (remainingCalls === 0) {
        deferred.resolve();
      } else if (remainingCalls < 0) {
        throw new Error('resolve called too many times');
      }
    },

    reject(error: InternError) {
      benchmark.error = error;
      benchmark.abort();
      deferred.resolve();
    },

    rejectOnError(this: any, callback: Function) {
      const self = this;
      return function(this: any) {
        try {
          return callback.apply(this, arguments);
        } catch (error) {
          self.reject(error);
        }
      };
    },

    callback: function(this: any, callback: Function) {
      const self = this;
      return this.rejectOnError(function(this: any) {
        const returnValue = callback.apply(this, arguments);
        self.resolve();
        return returnValue;
      });
    }
  } as Deferred<void>;
}
