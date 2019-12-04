import _ErrorFormatter from 'src/core/lib/common/ErrorFormatter';
import { InternError } from 'src/core/lib/types';
import { createMockExecutor, MockExecutor } from 'tests/support/unit/mocks';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

let ErrorFormatter: typeof _ErrorFormatter;

registerSuite('lib/common/ErrorFormatter', function() {
  function diffJson(_a: object, _b: object) {
    return (
      diffValue || [
        { value: 'a', added: true, removed: undefined },
        { value: 'b', added: undefined, removed: undefined },
        { value: 'c\n', added: undefined, removed: true }
      ]
    );
  }

  let diffValue:
    | undefined
    | { value: string; added?: boolean; removed?: boolean }[];
  let removeMocks: () => void;

  return {
    before() {
      return mockRequire(require, 'src/core/lib/common/ErrorFormatter', {
        diff: { diffJson }
      }).then(handle => {
        removeMocks = handle.remove;
        ErrorFormatter = handle.module.default;
      });
    },

    after() {
      removeMocks();
    },

    beforeEach() {
      diffValue = undefined;
    },

    tests: {
      '#format': (function() {
        let executor: MockExecutor;
        let formatter: _ErrorFormatter;

        return {
          beforeEach() {
            executor = createMockExecutor();
            executor.config.filterErrorStack = false;
            formatter = new ErrorFormatter(executor);
          },

          tests: {
            string() {
              assert.equal(formatter.format('foo'), 'foo');
            },

            error() {
              let error = new Error('foo');
              if (error.stack) {
                assert.match(
                  formatter.format(error),
                  /^Error: foo\n  at (?:\S*\.)?error /
                );
              } else {
                assert.equal(
                  formatter.format(error),
                  'Error: foo\nNo stack or location'
                );
              }

              error = <InternError>{ message: 'foo' };
              assert.equal(
                formatter.format(error),
                'Error: foo\nNo stack or location'
              );
            },

            diff() {
              let err: InternError = {
                name: 'Foo',
                message: 'foo',
                showDiff: true,
                actual: { foo: 1 },
                expected: { foo: 2 }
              };
              assert.equal(
                formatter.format(err),
                'Foo: foo\n\nE a\n  b\nA c\n\n\nNo stack or location'
              );

              diffValue = [{ value: 'no diff' }];
              assert.equal(
                formatter.format(err),
                'Foo: foo\nNo stack or location',
                'Diff with no adds or removals should not be shown'
              );
            },

            'firefox error'() {
              const err: any = {
                message: 'Bad thing happened',
                fileName: 'foo.txt',
                lineNumber: 10,
                columnNumber: 15
              };
              assert.equal(
                formatter.format(err),
                'Error: Bad thing happened\n  at foo.txt:10:15\nNo stack'
              );
            },

            'format with space'() {
              const err = <InternError>{ message: 'foo' };
              assert.equal(
                formatter.format(err, { space: '  ' }),
                'Error: foo\n  No stack or location'
              );
            },

            'normalized stack': {
              'chrome format'() {
                const err = <InternError>{
                  message: 'foo',
                  stack: 'Error: foo\n  at function (somefile.js:10:20)'
                };
                assert.equal(
                  formatter.format(err),
                  'Error: foo\n  at function @ somefile.js:10:20'
                );
              },

              'safari format'() {
                const err = <InternError>{
                  message: 'foo',
                  stack:
                    'function@somefile.js:10:20\n' +
                    'http://somewhere.com/otherfile.js:10:20'
                };
                assert.equal(
                  formatter.format(err),
                  'Error: foo\n' +
                    '  at function @ somefile.js:10:20\n' +
                    '  @ http://somewhere.com/otherfile.js:10:20'
                );
              },

              filtered() {
                executor.config.filterErrorStack = true;
                const err = <InternError>{
                  message: 'foo',
                  stack:
                    'Error: foo\n' +
                    '  at function (somefile.js:10:20)\n' +
                    '  at takeScreenshot (node_modules/leadfoot/Session.js:10:20)\n' +
                    '  at doThing (node_modules/lodash/lodash.js:10:20)\n' +
                    '  at other (appfile.js:10:20)'
                };
                assert.equal(
                  formatter.format(err),
                  'Error: foo\n  at function @ somefile.js:10:20\n' +
                    '  at takeScreenshot @ node_modules/leadfoot/Session.js:10:20\n' +
                    '  at other @ appfile.js:10:20'
                );
              }
            }
          }
        };
      })()
    }
  };
});
