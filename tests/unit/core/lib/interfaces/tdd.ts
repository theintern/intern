import { createSandbox } from 'sinon';
import { Task } from 'src/common';

import * as _tddInt from 'src/core/lib/interfaces/tdd';
import Test, { isTest } from 'src/core/lib/Test';
import Suite, { isSuite } from 'src/core/lib/Suite';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

registerSuite('lib/interfaces/tdd', function() {
  let tddInt: typeof _tddInt;
  let removeMocks: () => void;
  let parent: Suite;
  const sandbox = createSandbox();

  const executor = {
    addSuite: sandbox.spy((callback: (suite: Suite) => void) => {
      callback(parent);
    }),
    emit: sandbox.spy(() => Task.resolve())
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
    before() {
      return mockRequire(require, 'src/core/lib/interfaces/tdd', {
        'src/common': { global: mockGlobal }
      }).then(handle => {
        removeMocks = handle.remove;
        tddInt = handle.module;
      });
    },

    after() {
      removeMocks();
    },

    beforeEach() {
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

      suite() {
        tddInt.suite('foo', () => {});
        assert.lengthOf(parent.tests, 1);
        assert.instanceOf(parent.tests[0], Suite);
        assert.equal(parent.tests[0].name, 'foo');
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
          before: createTest('before', false),
          after: createTest('after', false),
          beforeEach: createTest('beforeEach', true),
          afterEach: createTest('afterEach', true)
        };
      })(),

      'multiple of same lifecycle method'() {
        let firstIsResolved = false;
        const dfd = this.async();

        tddInt.suite('foo', () => {
          tddInt.beforeEach(() => {
            return new Promise<void>(resolve => {
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
              return new Promise<void>(resolve => {
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
      }
    }
  };
});
