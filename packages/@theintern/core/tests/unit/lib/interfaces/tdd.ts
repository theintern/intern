import { mockImport } from 'tests/support/mockUtil';
import { createSandbox } from 'sinon';

import * as _tddInt from 'src/lib/interfaces/tdd';
import Test, { isTest } from 'src/lib/Test';
import Suite, { isSuite } from 'src/lib/Suite';

registerSuite('lib/interfaces/tdd', function () {
  let tddInt: typeof _tddInt;
  let parent: Suite;
  const sandbox = createSandbox();

  const executor = {
    addSuite: sandbox.spy((callback: (suite: Suite) => void) => {
      callback(parent);
    }),
    emit: sandbox.spy(() => Promise.resolve()),
  };
  const getIntern = sandbox.spy(() => {
    return executor;
  });
  const mockGlobal = {
    get intern() {
      return getIntern();
    },
  };

  return {
    async beforeEach() {
      // Re-import tdd before each test to ensure the module-level variables are
      // reset
      tddInt = await mockImport(
        () => import('src/lib/interfaces/tdd'),
        (replace) => {
          replace(() => import('@theintern/common'))
            .transparently()
            .with({ global: mockGlobal });
          // Pass in our versions of Suite and Test since we'll be using
          // instanceof in some of the tests below. Without doing this, the test
          // tdd interface would have its own copies of Suite and Test.
          replace(() => import('src/lib/Suite')).withDefault(Suite);
          replace(() => import('src/lib/Test')).withDefault(Test);
        }
      );
      sandbox.resetHistory();
      parent = new Suite(<any>{ name: 'parent', executor });
    },

    tests: {
      getInterface() {
        const iface = tddInt.getInterface(<any>executor);
        assert.isFunction(iface.suite);
        assert.isFunction(iface.test);
        assert.isFunction(iface.before);
        assert.isFunction(iface.after);
        assert.isFunction(iface.beforeEach);
        assert.isFunction(iface.afterEach);

        iface.suite('fooSuite', () => {});
        assert.lengthOf(parent.tests, 1);
        assert.equal(parent.tests[0].name, 'fooSuite');
      },

      suite: {
        normal() {
          tddInt.suite('foo', () => {});
          assert.lengthOf(parent.tests, 1);
          assert.instanceOf(parent.tests[0], Suite);
          assert.equal(parent.tests[0].name, 'foo');
        },

        async() {
          assert.throws(
            // eslint-disable-next-line
            // @ts-expect-error
            () => tddInt.suite('foo', async () => {}),
            /async/,
            'using an async suite function should throw'
          );
        },
      },

      test() {
        tddInt.suite('foo', () => {
          tddInt.test('bar', () => {});
        });
        const child = (<Suite>parent.tests[0]).tests[0];
        assert.instanceOf(child, Test);
        assert.equal(child.name, 'bar');

        assert.throws(() => {
          tddInt.test('baz', () => {});
        }, /must be declared/);
      },

      xsuite() {
        tddInt.xsuite('suite name', () => {
          tddInt.test('contained tests do not run', () => {
            assert.fail('Tests inside a skipped suite should not run');
          });
        });

        const suite = <Suite>parent.tests[0];
        assert.equal(suite.name, 'suite name');
        assert.equal(suite.tests[0].name, 'contained tests do not run');

        return suite.run().then(() => {
          assert.equal(
            suite.skipped,
            'suite skipped',
            'suite should be skipped'
          );
          assert.equal(
            suite.tests[0].skipped,
            'suite skipped',
            'child should be skipped'
          );
        });
      },

      xtest() {
        let testRan = false;

        tddInt.suite('parent suite', () => {
          tddInt.xtest('skip test with factory', () => {
            assert.fail('Skipped tests should not run');
          });
          tddInt.xtest('skip test stub');
          tddInt.test('still runs other tests', () => {
            testRan = true;
          });
        });

        const suite = <Suite>parent.tests[0];
        assert.equal(suite.tests[0].name, 'skip test with factory');
        assert.equal(suite.tests[1].name, 'skip test stub');
        assert.equal(suite.tests[2].name, 'still runs other tests');

        suite.run().then(() => {
          assert.isTrue(testRan, 'the non-skipped test should have run');
          assert.equal(
            suite.tests[0].skipped,
            'skipped',
            'first test should be skipped'
          );
          assert.equal(
            suite.tests[1].skipped,
            'not implemented',
            'second test should be skipped'
          );
          assert.isUndefined(
            suite.tests[2].skipped,
            'last test should not be skipped'
          );
        });
      },

      'lifecycle methods': (() => {
        type lifecycle = 'before' | 'beforeEach' | 'after' | 'afterEach';
        function createTest(name: lifecycle, hasTestArg: boolean) {
          return () => {
            tddInt.suite('foo', () => {
              (tddInt[name] as any)((arg: any) => {
                firstArg = arg;
              });

              tddInt.test('bar', () => {});
            });
            const suite = <Suite>parent.tests[0];
            assert.instanceOf(suite[name], Function);

            let firstArg: any;

            assert.throws(() => {
              (tddInt[name] as any)(() => {});
            }, /must be declared/);

            return suite.run().then(() => {
              assert.isDefined(
                firstArg,
                'lifecycle method should have been passed an arg'
              );
              if (hasTestArg) {
                assert.isTrue(
                  isTest(firstArg),
                  'expected first arg to be a test'
                );
              } else {
                assert.isTrue(
                  isSuite(firstArg),
                  'expected first arg to be a suite'
                );
              }
            });
          };
        }

        return {
          tests: {
            beforeMethod: createTest('before', false),
            afterMethod: createTest('after', false),
            beforeEachMethod: createTest('beforeEach', true),
            afterEachMethod: createTest('afterEach', true),
          },
        };
      })(),

      'multiple of same lifecycle method'() {
        let firstIsResolved = false;
        const dfd = this.async();

        tddInt.suite('foo', () => {
          tddInt.beforeEach(() => {
            return new Promise<void>((resolve) => {
              setTimeout(() => {
                firstIsResolved = true;
                resolve(<any>'foo');
              }, 100);
            });
          });

          tddInt.beforeEach(
            dfd.rejectOnError(() => {
              assert.isTrue(
                firstIsResolved,
                'expected first beforeEach to be resolved'
              );
              return new Promise<void>((resolve) => {
                setTimeout(() => {
                  resolve(<any>'bar');
                }, 100);
              });
            })
          );

          tddInt.test('fooTest', () => {});
        });

        const suite = <Suite>parent.tests[0];
        const beforeEach = suite.beforeEach!;
        const result = beforeEach.call(suite, <any>{}, <any>{}) as
          | Promise<string>
          | string;
        Promise.resolve<string>(result).then(
          dfd.callback((result: string) => {
            assert.equal(result, 'bar');
          })
        );
      },

      'nested suites'() {
        tddInt.suite('fooSuite', () => {
          tddInt.test('foo', () => {});
          tddInt.suite('bar', () => {
            tddInt.beforeEach(() => {});

            tddInt.test('up', () => {});
            tddInt.test('down', () => {});
          });
          tddInt.suite('baz', () => {
            tddInt.test('one', () => {});
            tddInt.test('down', () => {});
          });
        });

        assert.lengthOf(
          parent.tests,
          1,
          'one child should have been defined on parent'
        );
        const suite = <Suite>parent.tests[0];
        assert.lengthOf(suite.tests, 3, 'expect suite to have 3 children');

        assert.instanceOf(suite.tests[0], Test);
        assert.equal(suite.tests[0].name, 'foo');

        assert.instanceOf(suite.tests[1], Suite);
        assert.equal(suite.tests[1].name, 'bar');
        assert.isFunction(
          (<Suite>suite.tests[1]).beforeEach,
          'expected suite to have a beforeEach method'
        );

        assert.instanceOf(suite.tests[2], Suite);
        assert.equal(suite.tests[2].name, 'baz');
      },
    },
  };
});
