import { mockImport } from '@theintern-dev/test-util';
import { createSandbox } from 'sinon';

import * as _objInt from 'src/lib/interfaces/object';
import Test from 'src/lib/Test';
import Suite from 'src/lib/Suite';

registerSuite('lib/interfaces/object', function () {
  let objInt: typeof _objInt;
  let parent: Suite;

  const sandbox = createSandbox();

  const executor = {
    addSuite: sandbox.spy((callback: (suite: Suite) => void) => {
      callback(parent);
    }),
    emit: sandbox.spy((..._args: any[]) => Promise.resolve()),
    log: sandbox.spy((..._args: any[]) => {})
  };

  const getIntern = sandbox.spy(() => {
    return executor;
  });

  const mockGlobal = {
    get intern() {
      return getIntern();
    }
  };

  return {
    async before() {
      objInt = await mockImport(
        () => import('src/lib/interfaces/object'),
        replace => {
          replace(() => import('@theintern/common')).with({
            global: mockGlobal
          });
          // Pass in our versions of Suite and Test since we'll be using
          // instanceof in some of the tests below. Without doing this, the test
          // tdd interface would have its own copies of Suite and Test.
          replace(() => import('src/lib/Suite')).withDefault(Suite);
          replace(() => import('src/lib/Test'))
            .transparently()
            .withDefault(Test);
        }
      );
    },

    beforeEach() {
      sandbox.reset();
    },

    tests: {
      registerSuite: (() => {
        function verify() {
          assert.equal(getIntern.callCount, 1);
          assert.equal(executor.addSuite.callCount, 1);
          assert.isFunction(
            executor.addSuite.getCall(0).args[0],
            'expected arg to be a callback'
          );
          assert.lengthOf(parent.tests, 1);
          assert.instanceOf(parent.tests[0], Suite);

          const suite = <Suite>parent.tests[0];
          assert.strictEqual(suite.parent, parent);

          assert.equal(suite.name, 'fooSuite');
          assert.property(suite, 'beforeEach');

          assert.lengthOf(suite.tests, 2);
          assert.instanceOf(suite.tests[0], Test);
          assert.propertyVal(suite.tests[0], 'name', 'foo');
          assert.instanceOf(suite.tests[1], Test);
          assert.propertyVal(suite.tests[1], 'name', 'bar');
        }

        return {
          descriptor() {
            parent = new Suite(<any>{ name: 'parent', executor });
            objInt.default('fooSuite', {
              beforeEach() {},
              timeout: 10,
              bail: false,
              grep: /foo/,
              tests: {
                foo() {},
                bar() {}
              }
            });

            verify();
          },

          factory() {
            parent = new Suite(<any>{ name: 'parent', executor });
            objInt.default('fooSuite', function () {
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

      getInterface() {
        const iface = objInt.getInterface(<any>executor);
        assert.property(iface, 'registerSuite');
        assert.isFunction(iface.registerSuite);

        iface.registerSuite('foo', {});
        assert.equal(executor.addSuite.callCount, 1);
        assert.isFunction(
          executor.addSuite.getCall(0).args[0],
          'expected arg to be a callback'
        );
      },

      isSuiteDescriptorFactory() {
        assert.isTrue(objInt.isSuiteDescriptorFactory(() => {}));
        assert.isFalse(objInt.isSuiteDescriptorFactory({}));
      },

      createSuite: {
        deprecated() {
          const suite: Suite = <any>{ executor };
          objInt.createSuite(
            'foo',
            suite,
            {
              setup() {},
              tests: {}
            },
            Suite,
            Test
          );
          assert.equal(executor.emit.callCount, 1);
          assert.equal(executor.emit.getCall(0).args[0], 'deprecated');

          objInt.createSuite(
            'bar',
            suite,
            {
              teardown() {},
              tests: {}
            },
            Suite,
            Test
          );
          assert.equal(executor.emit.callCount, 2);
          assert.equal(executor.emit.getCall(1).args[0], 'deprecated');
        },

        'suite descriptor'() {
          parent = new Suite(<any>{ name: 'parent', executor });
          const suite = objInt.createSuite(
            'fooSuite',
            parent,
            {
              beforeEach() {},
              tests: {
                foo() {},
                bar() {}
              }
            },
            Suite,
            Test
          );

          assert.strictEqual(suite.parent, parent);
          assert.equal(suite.name, 'fooSuite');
          assert.property(suite, 'beforeEach');

          assert.lengthOf(suite.tests, 2);
          assert.instanceOf(suite.tests[0], Test);
          assert.propertyVal(suite.tests[0], 'name', 'foo');
          assert.instanceOf(suite.tests[1], Test);
          assert.propertyVal(suite.tests[1], 'name', 'bar');
        },

        'only tests'() {
          parent = new Suite(<any>{ name: 'parent', executor });
          const suite = objInt.createSuite(
            'foo',
            parent,
            {
              foo() {},
              bar() {}
            },
            Suite,
            Test
          );

          assert.strictEqual(suite.parent, parent);

          assert.lengthOf(suite.tests, 2);
          assert.instanceOf(suite.tests[0], Test);
          assert.propertyVal(suite.tests[0], 'name', 'foo');
          assert.instanceOf(suite.tests[1], Test);
          assert.propertyVal(suite.tests[1], 'name', 'bar');
        },

        'tests with lifecycle-method names'() {
          parent = new Suite(<any>{ name: 'parent', executor });
          objInt.createSuite(
            'foo',
            parent,
            <any>{
              before() {},
              foo() {}
            },
            Suite,
            Test
          );
          assert.equal(executor.emit.callCount, 3);
          // Suite should emit a log message
          assert.equal(executor.emit.args[0][0], 'warning');
          assert.match(
            executor.emit.args[0][1],
            /Created test with lifecycle method name/,
            'expected log message to mention test name'
          );
        },

        'nested suites'() {
          parent = new Suite(<any>{ name: 'parent', executor });
          const suite = objInt.createSuite(
            'fooSuite',
            parent,
            {
              foo() {},
              bar: {
                beforeEach() {},

                tests: {
                  up() {},
                  down() {}
                }
              },
              baz: {
                one() {},
                two() {}
              }
            },
            Suite,
            Test
          );

          assert.strictEqual(suite.parent, parent);

          assert.lengthOf(suite.tests, 3);

          assert.instanceOf(suite.tests[0], Test);
          assert.propertyVal(suite.tests[0], 'name', 'foo');

          assert.instanceOf(suite.tests[1], Suite);
          const suite1 = <Suite>suite.tests[1];
          assert.propertyVal(suite1, 'name', 'bar');
          assert.lengthOf(suite1.tests, 2);
          assert.isFunction(suite1.beforeEach);

          assert.instanceOf(suite.tests[2], Suite);
          const suite2 = <Suite>suite.tests[2];
          assert.propertyVal(suite2, 'name', 'baz');
          assert.lengthOf(suite2.tests, 2);
        }
      }
    }
  };
});
