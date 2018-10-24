import { spy, stub } from 'sinon';

import _JUnit from 'src/lib/reporters/JUnit';
import Test from 'src/lib/Test';
import Suite from 'src/lib/Suite';

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

  const generateTestCaseSkippedXmlSnippet = (
    testName: string,
    time: string,
    skippedMessage: string
  ) => {
    return (
      `<testcase name="${testName}" time="${time}" status="0">` +
      `<skipped>${skippedMessage}</skipped>` +
      '</testcase>'
    );
  };

  const generateTestCaseErrorXmlSnippet = (
    testName: string,
    message: string,
    type: string,
    time: string
  ) => {
    return (
      `<testcase name="${testName}" time="${time}" status="1">` +
      `<error message="${message}" type="${type}">${message}</error>` +
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

        'suite errors '() {
          const suiteError = new Error('Suite setup failed');
          const passingTestName = 'passing test name';
          const skippedTestName = 'skipped test';
          const skippedMessage = 'skipped test within a failing suite';

          const suite = new Suite(<any>{
            sessionId: 'foo',
            name: 'chrome 32 on Mac',
            executor: mockExecutor,
            timeElapsed: 1234,
            tests: [
              new Suite(<any>{
                name: '1',
                executor: mockExecutor,
                timeElapsed: 1234,
                error: suiteError,
                tests: [
                  new Suite(<any>{
                    name: '1.1',
                    executor: mockExecutor,
                    timeElapsed: 45,
                    tests: [
                      new Test(<any>{
                        name: passingTestName,
                        test() {},
                        hasPassed: true,
                        timeElapsed: 40
                      }),
                      new Test(<any>{
                        name: skippedTestName,
                        test() {},
                        skipped: skippedMessage,
                        hasPassed: false,
                        timeElapsed: 0
                      })
                    ]
                  })
                ]
              })
            ]
          });

          mockExecutor.suites.push(suite);

          const expectedError = generateTestCaseErrorXmlSnippet(
            passingTestName,
            suiteError.message,
            'SuiteError',
            '0.04'
          );

          assert.include(
            getReportOutput(),
            expectedError,
            'descendant test should be failing with suite error'
          );

          const expectedSkipped = generateTestCaseSkippedXmlSnippet(
            skippedTestName,
            '0',
            skippedMessage
          );

          assert.include(
            getReportOutput(),
            expectedSkipped,
            'descendant skipped test should not report error'
          );
        }
      }
    }
  };
});
