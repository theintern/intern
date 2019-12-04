import { join } from 'path';

import _ErrorFormatter from 'src/core/lib/node/ErrorFormatter';
import { InternError } from 'src/core/lib/types';
import { createMockNodeExecutor, MockNode } from 'tests/support/unit/mocks';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

let ErrorFormatter: typeof _ErrorFormatter;

registerSuite('lib/node/ErrorFormatter', function() {
  class SourceMapConsumer {
    map: { file: string };
    constructor(map: { file: string }) {
      this.map = map;
    }

    originalPositionFor(position: {
      line: number;
      column: number;
      source?: string;
    }) {
      position = { ...position };
      position.source = this.map.file;
      if (position.line > 20) {
        delete position.line;
      }
      return position;
    }

    eachMapping(callback: (entry: any) => {}) {
      [
        {
          generatedLine: 30,
          generatedColumn: 15,
          originalLine: 33,
          originalColumn: 22
        },
        {
          generatedLine: 30,
          generatedColumn: 20,
          originalLine: 34,
          originalColumn: 22
        },
        {
          generatedLine: 30,
          generatedColumn: 21,
          originalLine: 35,
          originalColumn: 22
        }
      ].forEach(callback);
    }
  }

  const mockPath = {
    dirname() {
      return '';
    },
    join(...args: string[]) {
      return join(...args);
    },
    relative(_from: string, to: string) {
      return to;
    },
    resolve(path: string) {
      return path;
    }
  };

  const mockFs = {
    readFileSync(filename: string) {
      if (fsData[filename]) {
        return fsData[filename];
      }
      const error = new Error('File not found');
      (<any>error).code = 'ENOENT';
      throw error;
    }
  };

  const mockUtil = {
    readSourceMap(filename: string) {
      if (filename === 'hasmap.js') {
        return {};
      }
    }
  };

  let fsData: { [name: string]: string };
  let removeMocks: () => void;

  return {
    before() {
      return mockRequire(require, 'src/core/lib/node/ErrorFormatter', {
        'source-map': { SourceMapConsumer },
        path: mockPath,
        fs: mockFs,
        'src/core/lib/node/util': mockUtil
      }).then(handle => {
        removeMocks = handle.remove;
        ErrorFormatter = handle.module.default;
      });
    },

    after() {
      removeMocks();
    },

    beforeEach() {
      fsData = {};
    },

    tests: {
      '#format': (function() {
        let executor: MockNode;
        let formatter: _ErrorFormatter;

        return {
          beforeEach() {
            executor = createMockNodeExecutor();
            executor.config.filterErrorStack = false;
            executor.instrumentedMapStore = {
              data: {
                'instrumented.js': {
                  data: {
                    file: 'instrumented.js'
                  }
                }
              }
            };
            executor.sourceMapStore = {
              data: {
                'noninstrumented.js': {
                  data: {
                    file: 'noninstrumented.js'
                  }
                }
              }
            };
            formatter = new ErrorFormatter(executor);
          },

          tests: {
            string() {
              assert.equal(formatter.format('foo'), 'foo');
            },

            'with stack': {
              'anonymous entry'() {
                const err = <InternError>{
                  message: 'foo',
                  stack: 'Error: foo\n  at <anonymous>'
                };
                assert.equal(
                  formatter.format(err),
                  'Error: foo\n  @ anonymous'
                );
              },

              'no line/col data'() {
                const err = <InternError>{
                  message: 'foo',
                  stack: 'Error: foo\n  at function (somefile.js)'
                };
                assert.equal(
                  formatter.format(err),
                  'Error: foo\n  at function @ somefile.js'
                );
              },

              'instrumented file'() {
                const err = <InternError>{
                  message: 'foo',
                  stack: 'Error: foo\n  at function (instrumented.js:10:20)'
                };
                assert.equal(
                  formatter.format(err),
                  'Error: foo\n  at function @ instrumented.js:10:20'
                );
              },

              'exact position in source map'() {
                const err = <InternError>{
                  message: 'foo',
                  stack: 'Error: foo\n  at function1 (noninstrumented.js:10:20)'
                };
                assert.equal(
                  formatter.format(err),
                  'Error: foo\n  at function1 @ noninstrumented.js:10:20'
                );
              },

              'approximate position in source map'() {
                const err = <InternError>{
                  message: 'foo',
                  stack: 'Error: foo\n  at function2 (noninstrumented.js:30:20)'
                };
                assert.equal(
                  formatter.format(err),
                  'Error: foo\n  at function2 @ noninstrumented.js:34:22',
                  'expected stack trace to use closest entry found in map'
                );
              },

              'no match in source map'() {
                const err = <InternError>{
                  message: 'foo',
                  stack: 'Error: foo\n  at function2 (noninstrumented.js:40:20)'
                };
                assert.equal(
                  formatter.format(err),
                  'Error: foo\n  at function2 @ noninstrumented.js:40:20',
                  'expected stack trace to use original position'
                );
              },

              'map not in store'() {
                fsData['hasmap.js'] = JSON.stringify({});
                fsData['hasnomap.js'] = JSON.stringify({});

                const err = <InternError>{
                  message: 'foo',
                  stack:
                    'Error: foo\n  ' +
                    'at function2 (hasmap.js:40:20)\n' +
                    'at function2 (hasmap.js:44:21)\n' +
                    'at function2 (hasnomap.js:40:20)\n' +
                    'at function2 (hasnomap.js:50:30)'
                };
                assert.equal(
                  formatter.format(err),
                  'Error: foo\n' +
                    '  at function2 @ hasmap.js:40:20\n' +
                    '  at function2 @ hasmap.js:44:21\n' +
                    '  at function2 @ hasnomap.js:40:20\n' +
                    '  at function2 @ hasnomap.js:50:30',
                  'expected stack trace to use original position'
                );
              }
            }
          }
        };
      })()
    }
  };
});
