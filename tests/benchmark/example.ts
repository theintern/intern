import Test from '../../src/core/lib/Test';
import {
  BenchmarkTestFunction,
  BenchmarkDeferredTestFunction
} from '../../src/core/lib/BenchmarkTest';
import Deferred from '../../src/core/lib/Deferred';

const { registerSuite, async } = intern.getPlugin('interface.benchmark');

registerSuite('example benchmarks', {
  test1() {
    2 * 2;
  },

  test2: (function() {
    const test: BenchmarkTestFunction = function() {
      [1, 2, 3, 4, 5].forEach(function(item) {
        item = item * item;
      });
    };

    test.options = {};

    return test;
  })(),

  nested: (function() {
    let counter = 0;

    return {
      beforeEachLoop() {
        counter = 0;
      },

      tests: {
        nested1() {
          counter * 23;
        },

        nested2() {
          counter / 12;
        }
      }
    };
  })(),

  async: async(<BenchmarkDeferredTestFunction>(
    function(deferred: Deferred<void>) {
      setTimeout(
        deferred.callback(function() {
          return 23 / 400;
        }),
        200
      );
    }
  )),

  skip(this: Test) {
    this.skip('this does nothing now');
  },

  'async skip'(this: Test) {
    this.skip('this also does nothing now');
  }
});
