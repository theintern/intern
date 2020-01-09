import { mockImport } from 'tests/support/mockUtil';
import { spy } from 'sinon';

import BenchmarkTest, {
  BenchmarkTestFunction
} from 'src/core/lib/BenchmarkTest';
import BenchmarkSuite from 'src/core/lib/BenchmarkSuite';
import Suite from 'src/core/lib/Suite';

registerSuite('core/lib/interfaces/benchmark', function() {
  let benchmarkInt: typeof import('src/core/lib/interfaces/benchmark');
  let parent: Suite;
  let executor: any;
  const getIntern = spy(() => {
    return executor;
  });
  const mockGlobal = {
    get intern() {
      return getIntern();
    }
  };
  return {
    async before() {
      benchmarkInt = await mockImport(
        () => import('src/core/lib/interfaces/benchmark'),
        replace => {
          replace(() => import('src/common')).with({ global: mockGlobal });
          // Pass in our versions of Suite and Test since we'll be using
          // instanceof in some of the tests below. Without doing this, the test
          // tdd interface would have its own copies of Suite and Test.
          replace(() => import('src/core/lib/BenchmarkSuite')).withDefault(
            BenchmarkSuite
          );
          replace(() => import('src/core/lib/BenchmarkTest')).withDefault(
            BenchmarkTest
          );
        }
      );
    },

    beforeEach() {
      getIntern.resetHistory();
      executor = {
        config: { benchmark: true },
        addSuite: spy((callback: (suite: Suite) => void) => {
          callback(parent);
        }),
        emit: spy(() => {}),
        log: spy(() => {})
      };
      parent = new Suite(<any>{ name: 'parent', executor });
    },

    tests: {
      getInterface() {
        const iface = benchmarkInt.getInterface(executor);
        assert.property(iface, 'registerSuite');
        assert.isFunction(iface.registerSuite);

        iface.registerSuite('foo', {});
        assert.equal(executor.addSuite.callCount, 1);
        assert.isFunction(
          executor.addSuite.getCall(0).args[0],
          'expected arg to be a callback'
        );
      },

      'skip registration if benchmark is disabled'() {
        executor.config.benchmark = false;
        const iface = benchmarkInt.getInterface(executor);
        iface.registerSuite('foo', {});
        assert.equal(
          executor.addSuite.callCount,
          0,
          'addSuite should not have been called if benchmark is false'
        );
      },

      registerSuite: (() => {
        function verify() {
          assert.equal(getIntern.callCount, 1);
          assert.equal(executor.addSuite.callCount, 1);
          assert.isFunction(
            executor.addSuite.getCall(0).args[0],
            'expected arg to be a callback'
          );
          assert.lengthOf(parent.tests, 1);
          assert.instanceOf(parent.tests[0], BenchmarkSuite);

          const suite = <Suite>parent.tests[0];
          assert.strictEqual(suite.parent, parent);

          assert.equal(suite.name, 'fooSuite');
          assert.property(suite, 'beforeEach');

          assert.lengthOf(suite.tests, 2);
          assert.instanceOf(suite.tests[0], BenchmarkTest);
          assert.propertyVal(suite.tests[0], 'name', 'foo');
          assert.instanceOf(suite.tests[1], BenchmarkTest);
          assert.propertyVal(suite.tests[1], 'name', 'bar');
        }

        return {
          descriptor() {
            parent = new Suite(<any>{ name: 'parent', executor });
            benchmarkInt.default('fooSuite', {
              beforeEach() {},
              tests: {
                foo() {},
                bar() {}
              }
            });

            verify();
          },

          factory() {
            parent = new Suite(<any>{ name: 'parent', executor });
            benchmarkInt.default('fooSuite', function() {
              return {
                beforeEach() {},
                tests: {
                  foo() {},
                  bar() {}
                }
              };
            });

            verify();
          }
        };
      })(),

      'register with benchmark options'() {
        benchmarkInt.default('suite 1', {
          test1: (function() {
            const testFunction: BenchmarkTestFunction = () => {};
            testFunction.options = {
              initCount: 5
            };
            return testFunction;
          })()
        });

        assert.lengthOf(parent.tests, 1, 'suite should have 1 test');

        const suite = <BenchmarkSuite>parent.tests[0];
        assert.instanceOf(
          suite,
          BenchmarkSuite,
          'expected test to be a BenchmarkSuite'
        );

        const test = <BenchmarkTest>suite.tests[0];
        assert.instanceOf(
          test,
          BenchmarkTest,
          'expected test to be a BenchmarkTest'
        );
        assert.propertyVal(
          test.benchmark,
          'initCount',
          5,
          'expected test option to have been passed to Benchmark'
        );
      }
    }
  };
});
