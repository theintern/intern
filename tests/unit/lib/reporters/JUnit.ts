import { spy, stub } from 'sinon';

import _JUnit from 'src/lib/reporters/JUnit';
import Test from 'src/lib/Test';
import Suite, { SuiteError } from 'src/lib/Suite';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');
const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

registerSuite('lib/reporters/JUnit', function() {
  const mockExecutor = <any>{
    suites: [],
    on: spy(),
    emit: stub().resolves(),
    formatError: spy((error: Error) => error.message)
  };

  const mockFs = {
    createWriteStream: spy(),
    mkdirSync: spy()
  };

  let JUnit: typeof _JUnit;
  let removeMocks: () => void;

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

  const innerTestName = 'Inner test';
  const createSuiteWithError = (errorFactory: (test: Test) => SuiteError) => {
    const test = new Test(<any>{
      name: innerTestName,
      test() {},
      hasPassed: true,
      timeElapsed: 0
    });

    const suiteError = errorFactory(test);

    const suite = new Suite(<any>{
      sessionId: 'foo',
      name: 'chrome 32 on Mac',
      executor: mockExecutor,
      timeElapsed: 666,
      tests: [
        new Suite(<any>{
          name: '1',
          executor: mockExecutor,
          timeElapsed: 12,
          error: suiteError,
          tests: [test]
        })
      ]
    });

    mockExecutor.suites.push(suite);

    return getReportOutput();
  };

  const generateSuiteErrorTestCaseXmlSnippet = (
    suiteError: SuiteError,
    time = '0.012'
  ) => {
    const relatedTest = suiteError.relatedTest;
    const context = relatedTest
      ? `${suiteError.lifecycleMethod} - related test name: '${
          relatedTest.name
        }'`
      : `${suiteError.lifecycleMethod}`;
    const errorMessage = suiteError.message;

    return (
      `<testcase name="SuiteError#${context}" time="${time}" status="1">` +
      `<error message="${errorMessage}" type="Error">${errorMessage}</error>` +
      '</testcase>'
    );
  };

  return {
    before() {
      return mockRequire(require, 'src/lib/reporters/JUnit', {
        fs: mockFs
      }).then(handle => {
        removeMocks = handle.remove;
        JUnit = handle.module.default;
      });
    },

    after() {
      removeMocks();
    },

    beforeEach() {
      mockExecutor.suites = [];
      mockExecutor.on.reset();
      mockFs.createWriteStream.reset();
      mockFs.mkdirSync.reset();
    },

    tests: {
      construct() {
        new JUnit(mockExecutor, { filename: 'somewhere/foo.js' });
        assert.equal(mockFs.mkdirSync.callCount, 1);
        assert.equal(mockFs.mkdirSync.getCall(0).args[0], 'somewhere');
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

          mockExecutor.suites.push(suite.toJSON());

          assert.include(
            getReportOutput(),
            `name="${nestedTest}"`,
            'report does not contain nested test'
          );
        },

        'suite errors': {
          'error in before is reported and no tests are reported'() {
            const suiteError: SuiteError = new Error('Suite has failed');
            suiteError.lifecycleMethod = 'before';

            const report = createSuiteWithError(() => suiteError);

            assert.notInclude(
              report,
              innerTestName,
              'test within errored suite should not be reported'
            );

            assert.include(
              report,
              generateSuiteErrorTestCaseXmlSnippet(suiteError),
              'suite error should be included in the report'
            );
          },

          'error in after is reported along with test results'() {
            const suiteError: SuiteError = new Error('Suite has failed');
            suiteError.lifecycleMethod = 'after';

            const report = createSuiteWithError(() => suiteError);

            assert.include(
              report,
              innerTestName,
              'test within errored suite should be reported'
            );

            assert.include(
              report,
              generateSuiteErrorTestCaseXmlSnippet(suiteError),
              'suite error should be included in the report'
            );
          },

          'error in beforeEach is reported including the related test and no tests are reported'() {
            const suiteError: SuiteError = new Error('Suite has failed');
            suiteError.lifecycleMethod = 'beforeEach';

            const report = createSuiteWithError(relatedTest => {
              suiteError.relatedTest = relatedTest;
              return suiteError;
            });

            assert.notInclude(
              report,
              `<testcase name="${innerTestName}"`,
              'test within errored suite should not be reported'
            );

            assert.include(
              report,
              generateSuiteErrorTestCaseXmlSnippet(suiteError),
              'suite error should be included in the report'
            );
          },

          'error in afterEach is reported including the related test along with test results'() {
            const suiteError: SuiteError = new Error('Suite has failed');
            suiteError.lifecycleMethod = 'afterEach';

            const report = createSuiteWithError(relatedTest => {
              suiteError.relatedTest = relatedTest;
              return suiteError;
            });

            assert.include(
              report,
              `<testcase name="${innerTestName}"`,
              'test within errored suite should be reported'
            );

            assert.include(
              report,
              generateSuiteErrorTestCaseXmlSnippet(suiteError),
              'suite error should be included in the report'
            );
          }
        }
      }
    }
  };
});
