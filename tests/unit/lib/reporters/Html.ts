import _Html from 'src/lib/reporters/Html';
import { createMockBrowserExecutor } from '../../../support/unit/mocks';

const mockRequire = <mocking.MockRequire>intern.getPlugin('mockRequire');
const createDocument = intern.getPlugin<mocking.DocCreator>('createDocument');

const mockExecutor = createMockBrowserExecutor();

let Html: typeof _Html;
let removeMocks: () => void;
let doc: Document;
let reporter: _Html;

registerSuite('intern/lib/reporters/Html', {
	before() {
		return mockRequire(require, 'src/lib/reporters/Html', {
			'src/lib/reporters/html/html.styl': {}
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
		reporter = new Html(mockExecutor, { document: doc });
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

		suiteStart() {
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

		suiteEnd: {
			'root suite'() {
				const suite: any = {
					hasParent: false,
					tests: [],
					name: 'foo',
					id: 'foo',
					timeElapsed: 123
				};

				// Need to run runStart to setup doc for suiteStart
				reporter.runStart();
				reporter.suiteEnd(suite);

				const header = doc.body.getElementsByTagName('h1')[0];
				assert.isDefined(header, 'expected header element to exist');
				assert.equal(header.textContent, 'Intern Test Report');

				const summaryTable = doc.body.getElementsByTagName('table')[0];
				assert.isDefined(
					summaryTable,
					'expected result table to exist'
				);

				// Verify that the header was generated
				assert.equal(
					summaryTable.textContent,
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
					tests: [{}],
					name: 'foo',
					id: 'foo',
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
				const summaryTable = doc.body.getElementsByTagName('table')[0];
				const rate =
					100 -
					Math.round(suite.numFailedTests / suite.numTests * 100);
				assert.equal(
					summaryTable.textContent,
					`Suites1Tests${tests.length}Duration0:00.${suite.timeElapsed}` +
						`Skipped${suite.numSkippedTests}Failed${suite.numFailedTests}Success Rate${rate}%`
				);

				const reportTable = doc.body.getElementsByTagName('table')[1];
				assert.isDefined(reportTable, 'expected report table to exist');
				const tbody = reportTable.getElementsByTagName('tbody')[0];
				assert.isDefined(tbody, 'expected table body');

				const rows = tbody.getElementsByTagName('tr');
				assert.lengthOf(
					rows,
					1 + tests.length,
					'expected rows for the suite and tests'
				);

				tests.forEach((test, index) => {
					const row = rows[index + 1];
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
							id: 'foo - test',
							timeElapsed: 123
						}
					]);
				},

				failed() {
					doTest([
						{
							id: 'foo - test',
							timeElapsed: 123,
							error: new Error('failed')
						}
					]);
				},

				skipped() {
					doTest([
						{
							id: 'foo - test',
							timeElapsed: 123,
							skipped: 'yes'
						}
					]);
				}
			};
		})()
	}
});
