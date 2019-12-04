import _Html from 'src/core/lib/reporters/Html';
import { createMockBrowserExecutor } from 'tests/support/unit/mocks';
import { createLocation } from './support/mocks';

const mockRequire = <mocking.MockRequire>intern.getPlugin('mockRequire');
const createDocument = intern.getPlugin<mocking.DocCreator>('createDocument');

const mockExecutor = createMockBrowserExecutor();

let Html: typeof _Html;
let removeMocks: () => void;
let doc: Document;
let location: Location;
let reporter: _Html;

registerSuite('src/core/lib/reporters/Html', {
  before() {
    return mockRequire(require, 'src/core/lib/reporters/Html', {
      'src/core/lib/reporters/html/html.styl': {}
    }).then(resource => {
      removeMocks = resource.remove;
      Html = resource.module.default;
    });
  },

  after() {
    removeMocks();
  },

  beforeEach() {
    doc = createDocument();
    location = createLocation();
    reporter = new Html(mockExecutor, {
      document: doc,
      location: location
    });
  },

  tests: {
    error() {
      reporter.error(new Error('foo'));
      assert.lengthOf(doc.body.children, 1);
      assert.match(doc.body.textContent!, /^Fatal error/);
    },

    runStart() {
      reporter.runStart();
      assert.equal(
        doc.body.innerHTML,
        '',
        'runStart should not have altered the document'
      );
    },

    suiteStart: {
      'root suite'() {
        const suite: any = {
          parent: {},
          tests: [],
          name: 'foo',
          id: 'foo'
        };

        // Need to run runStart to setup doc for suiteStart
        reporter.runStart();
        reporter.suiteStart(suite);
        assert.equal(
          doc.body.innerHTML,
          '',
          'suiteStart should not have altered the document'
        );
      },

      'regular suite'() {
        const links: HTMLElement[] = [];
        const origCreateElement = reporter.document.createElement;
        reporter.document.createElement = function(
          tagName: string,
          options?: ElementCreationOptions
        ) {
          const retVal = origCreateElement.call(
            reporter.document,
            tagName,
            options
          );
          if (retVal.tagName === 'A') {
            links.push(retVal);
          }
          return retVal;
        };

        const suite: any = {
          hasParent: true,
          parent: {},
          tests: [],
          name: 'foo',
          id: 'foo'
        };

        // Need to run runStart to setup doc for suiteStart
        reporter.runStart();
        reporter.suiteStart(suite);
        reporter.document.createElement = origCreateElement;

        assert.lengthOf(links, 1);
        const link = links[0];

        assert.equal(
          link.getAttribute('href'),
          '?grep=foo',
          'expected link with selector for single test'
        );
        assert.equal(
          link.textContent,
          'foo',
          'link should contain the test name'
        );
      }
    },

    suiteEnd: {
      'root suite'() {
        const suite: any = {
          hasParent: false,
          tests: [],
          name: 'foo',
          id: 'foo',
          timeElapsed: 123,
          numTests: 1,
          numFailedTests: 0,
          numPassedTests: 1,
          numSkippedTests: 0
        };

        // Need to run runStart to setup doc for suiteStart
        reporter.runStart();
        reporter.suiteEnd(suite);

        const header = doc.body.getElementsByTagName('h1')[0];
        assert.isDefined(header, 'expected header element to exist');
        assert.equal(header.textContent, 'Intern Test Report');

        const summaryTable = doc.body.querySelector('.summary');
        assert.isNotNull(summaryTable, 'expected result table to exist');

        // Verify that the header was generated
        assert.equal(
          summaryTable!.textContent!.replace(/\n+/g, ''),
          'Suites0Tests0Duration0:00.123Skipped0Failed0Success Rate100%'
        );
      },

      'regular suite'() {
        const suite: any = {
          parent: {},
          hasParent: true,
          tests: [],
          name: 'foo',
          id: 'foo'
        };

        // Need to run runStart to setup doc for suiteStart
        reporter.runStart();
        // Need to run suiteStart to setup internal structures
        reporter.suiteStart(suite);
        reporter.suiteEnd(suite);
        assert.equal(
          doc.body.innerHTML,
          '',
          'suiteEnd should not have altered the document for a non-root suite'
        );
      }
    },

    testEnd: (() => {
      function doTest(tests: any[]) {
        const rootSuite: any = {
          hasParent: false,
          // suite with one test
          tests: [],
          name: 'foo',
          id: 'foo',
          get numPassedTests() {
            return suite.numPassedTests;
          },
          get numFailedTests() {
            return suite.numFailedTests;
          },
          get numSkippedTests() {
            return suite.numSkippedTests;
          },
          numTests: 1,
          timeElapsed: 123
        };

        const suite: any = {
          hasParent: true,
          parent: rootSuite,
          // suite with one test
          tests: [...tests],
          numTests: tests.length,
          numPassedTests: 0,
          numFailedTests: 0,
          numSkippedTests: 0,
          name: 'foo',
          id: 'foo',
          timeElapsed: 123
        };

        for (const test of tests) {
          if (test.skipped) {
            suite.numSkippedTests++;
          } else if (test.error) {
            suite.numFailedTests++;
          } else {
            suite.numPassedTests++;
          }
        }

        // Need to run runStart to setup doc for suiteStart
        reporter.runStart();
        reporter.suiteStart(rootSuite);
        reporter.suiteStart(suite);
        for (const test of tests) {
          reporter.testEnd(test);
        }
        reporter.suiteEnd(suite);
        reporter.suiteEnd(rootSuite);

        // Verify that the header was generated
        const summaryTable = doc.body.querySelector('.summary');
        assert.isNotNull(summaryTable, 'expected result table to exist');

        const rate =
          100 - Math.round((suite.numFailedTests / suite.numTests) * 100);
        assert.equal(
          summaryTable!.textContent!.replace(/\n+/g, ''),
          `Suites1Tests${tests.length}Duration0:00.${suite.timeElapsed}` +
            `Skipped${suite.numSkippedTests}Failed${suite.numFailedTests}Success Rate${rate}%`
        );

        const reportTable = doc.body.querySelector('table');
        assert.isNotNull(reportTable, 'expected report table to exist');
        const tbody = reportTable!.querySelector('tbody');
        assert.isNotNull(tbody, 'expected table body');

        const rows = tbody!.querySelectorAll('tr');
        assert.lengthOf(
          rows,
          1 + tests.length,
          'expected rows for the suite and tests'
        );

        tests.forEach((test, index) => {
          const row = rows[index + 1];
          const link = row.querySelectorAll('a')[0];
          assert.equal(
            link.getAttribute('href'),
            test.expectedLink,
            'expected link with for single test'
          );
          assert.equal(
            link.textContent,
            test.name,
            'link should contain the test name'
          );
          if (test.error) {
            assert.isTrue(row.classList.contains('failed'));
          } else if (test.skipped) {
            assert.isTrue(row.classList.contains('skipped'));
          } else {
            assert.isTrue(row.classList.contains('passed'));
          }
        });
      }

      return {
        passed() {
          doTest([
            {
              id: 'foo - test 1',
              name: 'test 1',
              expectedLink: '?grep=foo+-+test+1',
              timeElapsed: 123
            }
          ]);
        },

        failed() {
          doTest([
            {
              id: 'foo - test 2',
              name: 'test 2',
              expectedLink: '?grep=foo+-+test+2',
              timeElapsed: 123,
              error: new Error('failed')
            }
          ]);
        },

        skipped() {
          doTest([
            {
              id: 'foo - test 3',
              name: 'test 3',
              expectedLink: '?grep=foo+-+test+3',
              timeElapsed: 123,
              skipped: 'yes'
            }
          ]);
        }
      };
    })()
  }
});
