import { mockImport } from 'tests/support/mockUtil';
import { createSandbox } from 'sinon';

import Test from 'src/core/lib/Test';
import Suite from 'src/core/lib/Suite';
import Executor from 'src/core/lib/executors/Executor';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');

registerSuite('core/lib/reporters/JUnit', function() {
  const sandbox = createSandbox();

  const _mockExecutor = {
    suites: [] as any[],
    on: sandbox.spy(),
    emit: sandbox.stub().resolves(),
    formatError: sandbox.spy((error: Error) => error.message)
  };
  const mockExecutor = (_mockExecutor as unknown) as Executor<any, any, any>;

  const mockFs = {
    createWriteStream: sandbox.spy()
  };

  const mockNodeUtil = {
    mkdirp: sandbox.spy()
  };

  let JUnit: typeof import('src/core/lib/reporters/JUnit').default;

  const getReportOutput = () => {
    const text: string[] = [];
    const mockConsole = {
      write(data: string) {
        text.push(data);
      },
      end(data: string) {
        text.push(data);
      }
    };

    const junit = new JUnit(mockExecutor, { output: mockConsole });
    junit.runEnd();

    return text.join('');
  };

  return {
    async before() {
      ({ default: JUnit } = await mockImport(
        () => import('src/core/lib/reporters/JUnit'),
        replace => {
          replace(() => import('fs')).with(mockFs);
          replace(() => import('src/core/lib/node/util')).with(mockNodeUtil);
        }
      ));
    },

    beforeEach() {
      _mockExecutor.suites = [];
      sandbox.resetHistory();
    },

    tests: {
      construct() {
        let callCount = 0;
        (mockFs as any).existsSync = (dir: string) => {
          if (dir === 'somewhere' && callCount === 0) {
            callCount++;
            return false;
          }
          return true;
        };
        new JUnit(mockExecutor, { filename: 'somewhere/foo.js' });
        assert.equal(mockNodeUtil.mkdirp.callCount, 1);
        assert.equal(mockNodeUtil.mkdirp.getCall(0).args[0], 'somewhere');
        assert.equal(mockFs.createWriteStream.callCount, 1);
      },

      '#runEnd': {
        'local suites'() {
          const assertionError = new Error('Expected 1 + 1 to equal 3');
          assertionError.name = 'AssertionError';

          mockExecutor.suites.push(
            new Suite(<any>{
              sessionId: 'foo',
              name: 'chrome 32 on Mac',
              executor: mockExecutor,
              timeElapsed: 1234,
              tests: [
                new Suite(<any>{
                  name: 'suite1',
                  executor: mockExecutor,
                  timeElapsed: 1234,
                  tests: [
                    new Test(<any>{
                      name: 'test1',
                      test() {},
                      hasPassed: true,
                      timeElapsed: 45
                    }),
                    new Test(<any>{
                      name: 'test2',
                      test() {},
                      hasPassed: false,
                      error: new Error('Oops'),
                      timeElapsed: 45
                    }),
                    new Test(<any>{
                      name: 'test3',
                      test() {},
                      hasPassed: false,
                      error: assertionError,
                      timeElapsed: 45
                    }),
                    new Test(<any>{
                      name: 'test4',
                      test() {},
                      hasPassed: false,
                      skipped: 'No time for that',
                      timeElapsed: 45
                    }),
                    new Suite(<any>{
                      name: 'suite5',
                      executor: mockExecutor,
                      timeElapsed: 45,
                      tests: [
                        new Test(<any>{
                          name: 'test5.1',
                          test() {},
                          hasPassed: true,
                          timeElapsed: 40
                        })
                      ]
                    })
                  ]
                })
              ]
            })
          );

          const expected =
            '<?xml version="1.0" encoding="UTF-8" ?><testsuites>' +
            '<testsuite name="chrome 32 on Mac" failures="2" skipped="1" tests="5" time="1.234">' +
            '<testsuite name="suite1" failures="2" skipped="1" tests="5" time="1.234">' +
            '<testcase name="test1" time="0.045" status="0"/><testcase name="test2" time="0.045" status="1">' +
            '<error message="Oops" type="Error">Oops</error></testcase>' +
            '<testcase name="test3" time="0.045" status="1">' +
            '<failure message="Expected 1 + 1 to equal 3" type="AssertionError">Expected 1 + 1 to equal 3</failure>' +
            '</testcase><testcase name="test4" time="0.045" status="0"><skipped>No time for that</skipped>' +
            '</testcase><testsuite name="suite5" failures="0" skipped="0" tests="1" time="0.045">' +
            '<testcase name="test5.1" time="0.04" status="0"/></testsuite></testsuite></testsuite></testsuites>\n';

          assert.equal(
            getReportOutput(),
            expected,
            'report should exactly match expected output'
          );
        },

        'serialized suites'() {
          const nestedTest = 'test2.1';

          const suite = new Suite(<any>{
            sessionId: 'foo',
            name: 'chrome 32 on Mac',
            executor: mockExecutor,
            timeElapsed: 1234,
            tests: [
              new Suite(<any>{
                name: 'suite1',
                executor: mockExecutor,
                timeElapsed: 1234,
                tests: [
                  new Suite(<any>{
                    name: 'suite5',
                    executor: mockExecutor,
                    timeElapsed: 45,
                    tests: [
                      new Test(<any>{
                        name: nestedTest,
                        test() {},
                        hasPassed: true,
                        timeElapsed: 40
                      })
                    ]
                  })
                ]
              })
            ]
          });

          _mockExecutor.suites.push(suite.toJSON());

          assert.include(
            getReportOutput(),
            `name="${nestedTest}"`,
            'report does not contain nested test'
          );
        },

        'suite error in before'() {
          const assertionError = new Error('Expected 1 + 1 to equal 3');
          assertionError.name = 'AssertionError';
          const suiteError = new Error('Suite failed');
          (suiteError as any).lifecycleMethod = 'after';

          mockExecutor.suites.push(
            new Suite(<any>{
              sessionId: 'foo',
              name: 'chrome 32 on Mac',
              executor: mockExecutor,
              timeElapsed: 1234,
              tests: [
                new Suite(<any>{
                  name: 'suite1',
                  executor: mockExecutor,
                  timeElapsed: 1234,
                  error: suiteError,
                  tests: []
                })
              ]
            })
          );

          const expected =
            '<?xml version="1.0" encoding="UTF-8" ?><testsuites>' +
            '<testsuite name="chrome 32 on Mac" failures="0" skipped="0" tests="0" time="1.234">' +
            '<testsuite name="suite1" failures="0" skipped="0" tests="0" time="1.234">' +
            '<error message="Suite failed" type="Error">Suite failed</error>' +
            '</testsuite></testsuite></testsuites>\n';

          assert.equal(
            getReportOutput(),
            expected,
            'report should exactly match expected output'
          );
        },

        'suite error in beforeEach'() {
          const assertionError = new Error('Expected 1 + 1 to equal 3');
          assertionError.name = 'AssertionError';
          const suiteError = new Error('Suite failed');
          (suiteError as any).lifecycleMethod = 'beforeEach';

          mockExecutor.suites.push(
            new Suite(<any>{
              sessionId: 'foo',
              name: 'chrome 32 on Mac',
              executor: mockExecutor,
              error: suiteError,
              timeElapsed: 1234,
              tests: [
                new Test(<any>{
                  name: 'test1',
                  test() {},
                  suiteError
                }),
                new Test(<any>{
                  name: 'test2',
                  test() {},
                  suiteError
                }),
                new Test(<any>{
                  name: 'test3',
                  test() {},
                  suiteError
                }),
                new Test(<any>{
                  name: 'test4',
                  test() {},
                  suiteError
                })
              ]
            })
          );

          const expected =
            '<?xml version="1.0" encoding="UTF-8" ?><testsuites>' +
            '<testsuite name="chrome 32 on Mac" failures="0" skipped="0" tests="4" time="1.234">' +
            '<testcase name="test1" time="NaN" status="0">' +
            '<error message="Suite failed" type="Error">Suite failed</error>' +
            '</testcase>' +
            '<testcase name="test2" time="NaN" status="0">' +
            '<error message="Suite failed" type="Error">Suite failed</error>' +
            '</testcase>' +
            '<testcase name="test3" time="NaN" status="0">' +
            '<error message="Suite failed" type="Error">Suite failed</error>' +
            '</testcase>' +
            '<testcase name="test4" time="NaN" status="0">' +
            '<error message="Suite failed" type="Error">Suite failed</error>' +
            '</testcase>' +
            '</testsuite></testsuites>\n';

          assert.equal(
            getReportOutput(),
            expected,
            'report should exactly match expected output'
          );
        }
      }
    }
  };
});
