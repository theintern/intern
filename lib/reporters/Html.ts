import { AmdRequire } from '../util';
import { ReporterKwArgs, Reporter } from '../ReporterManager';
import Suite from '../Suite';
import Test from '../Test';

declare var require: AmdRequire;

function pad(value: any, size: number) {
	let padded = String(value);

	while (padded.length < size) {
		padded = '0' + padded;
	}

	return padded;
}

// Format a millisecond value to m:ss.SSS
// If duration is greater than 60 minutes, value will be HHHH:mm:ss.SSS
// (the hours value will not be converted to days)
function formatDuration(duration: number) {
	const hours = Math.floor(duration / 3600000);
	const minutes = Math.floor(duration / 60000) - (hours * 60);
	const seconds = Math.floor(duration / 1000) - (hours * 3600) - (minutes * 60);
	const milliseconds = duration - (hours * 3600000) - (minutes * 60000) - (seconds * 1000);
	let formattedValue = '';

	let formattedMinutes = String(minutes);
	if (hours) {
		formattedValue = hours + ':';
		formattedMinutes = pad(formattedMinutes, 2);
	}

	formattedValue += minutes + ':' + pad(seconds, 2) + '.' + pad(milliseconds, 3);

	return formattedValue;
}

interface HtmlReporterKwArgs extends ReporterKwArgs {
	document?: HTMLDocument;
}

export default class HtmlReporter implements Reporter {
	private fragment: DocumentFragment;

	// Array of td elements in 'summaryNode'
	private summaryNodes: HTMLSpanElement[] = [];

	// tbody element to append report rows to
	private reportNode: HTMLTableSectionElement;

	// Tests in the current suite
	private testsInSuite = 0;

	// Current test index
	private testIndex = 0;

	// Accumulator for total number of tests
	private testCount = 0;

	// Accumulator for total number of failed tests
	private failCount = 0;

	// Accumulator for total number of suites
	private suiteCount = 0;

	private indentLevel = 0;

	private runningSuites: { [id: string]: { node: HTMLTableRowElement; } } = {};

	private failedFilter: HTMLDivElement;

	private document: HTMLDocument;

	private reportContainer: HTMLElement;

	constructor(config: HtmlReporterKwArgs = {}) {
		this.document = config.document || window.document;
		this.fragment = this.document.createDocumentFragment();
	}

	start() {
		this.reportContainer = this.document.createElement('div');
		const headerNode = this.document.createElement('h1');
		let tableNode: HTMLTableElement;
		let rowNode: HTMLTableRowElement;
		let cellNode: HTMLTableCellElement;
		const summaryHeaders = [
			'Suites',
			'Tests',
			'Duration',
			'Failed',
			'Success Rate'
		];

		// Page header
		const headerTitle = this.document.createElement('span');
		headerTitle.className = 'headerTitle';
		headerTitle.innerHTML = 'Intern Test Report';

		headerNode.className = 'reportHeader';
		const headerLogo = this.document.createElement('img');
		headerLogo.className = 'headerLogo';
		headerLogo.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIIAAACACAMAAADwFUHEAAADAFBMVEUAAAAAAAAAAABVVVVAQEBmZmZVVVVtbW1gYGBVVVVmZmZdXV1qampiYmJtbW1mZmZwcHBpaWljY2Nra2tmZmZtbW1oaGhvb29qampwcHBsbGxoaGhtbW1qampvb29ra2twcHBsbGxxcXFtbW1qampubm5ra2tvb29sbGxwcHBtbW1xcXFubm5sbGxvb29tbW1wcHBtbW1wcHBubm5xcXFvb29tbW1vb29tbW1wcHBubm5wcHBvb29xcXFvb29tbW1wcHBubm5wcHBubm5xcXFvb29xcXFvb29ubm5wcHBubm5wcHBvb29xcXFvb29xcXFwcHBubm5wcHBwcHBvb29xcXFvb29ubm5xcXFwcHBvb29wcHBwcHBvb29xcXFwcHBubm5wcHBvb29wcHBvb29xcXFvb29xcXFwcHBvb29wcHBvb29wcHBvb29xcXFwcHBxcXFwcHBvb29wcHBvb29wcHBvb29xcXFwcHBxcXFwcHBvb29wcHBubm5wcHBwcHBwcHBxcXFwcHBvb29wcHBvb29xcXFwcHBwcHBvb29xcXFwcHBvb29wcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBvb29wcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBwcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBwcHBwcHBwcHBxcXFwcHBwcHBxcXFwcHBwcHBwcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBwcHBwcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBwcHBxcXFwcHBxcXFxcXFwcHBwcHBxcXFwcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBxcXFwcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBxcXFwcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBxcXFxcXFwcHBxcXFwcHBxcXFwcHBxcXFxcXFwcHBxcXFxcXFwcHBwcHBxcXFwcHBxcXFxcXFwcHBxcXFxcXFwcHBxcXF+cGExAAAA/3RSTlMAAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4/QEFCQ0RFRkdISUpLTE1O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';

		headerNode.appendChild(headerLogo);
		headerNode.appendChild(headerTitle);
		this.fragment.appendChild(headerNode);

		// Report container
		this.reportContainer.className = 'internReportContainer';
		this.fragment.appendChild(this.reportContainer);

		// Summary table
		tableNode = this.document.createElement('table');
		tableNode.className = 'summary';
		// tr element containing summary info
		const summaryNode = this.document.createElement('div');

		const headNode = this.document.createElement('thead');
		rowNode = this.document.createElement('tr');
		for (let i = 0; i < summaryHeaders.length; ++i) {
			cellNode = this.document.createElement('td');

			const cellContent = this.document.createElement('div');
			cellContent.className = 'summaryContent ' +
				summaryHeaders[i].toLowerCase().replace(/\s(.)/g, function (_, char) {
					return char.toUpperCase();
				});

			const cellTitle = this.document.createElement('span');
			cellTitle.className = 'summaryTitle';
			cellTitle.appendChild(this.document.createTextNode(summaryHeaders[i]));

			const cellData = this.document.createElement('div');
			cellData.className = 'summaryData';

			this.summaryNodes[i] = this.document.createElement('span');
			summaryNode.appendChild(this.summaryNodes[i]);

			cellData.appendChild(this.summaryNodes[i]);
			cellContent.appendChild(cellTitle);
			cellContent.appendChild(cellData);
			cellNode.appendChild(cellContent);
			rowNode.appendChild(cellNode);
		}

		headNode.appendChild(rowNode);
		tableNode.appendChild(headNode);
		this.reportContainer.appendChild(tableNode);

		// Report table
		tableNode = this.document.createElement('table');
		tableNode.className = 'report';
		const reportNode = this.reportNode = this.document.createElement('tbody');
		tableNode.appendChild(reportNode);
		this.reportContainer.appendChild(tableNode);
	}

	suiteStart(suite: Suite) {
		// There's a top-level Suite that contains all user-created suites
		// We want to skip it
		if (!suite.parent) {
			return;
		}

		this.testsInSuite = suite.tests.length;
		this.testIndex = 0;

		const rowNode = this.document.createElement('tr');

		// Status cell
		let cellNode = this.document.createElement('td');
		cellNode.className = 'testStatus';
		rowNode.appendChild(cellNode);

		cellNode = this.document.createElement('td');

		++this.suiteCount;

		cellNode.className = 'title';
		cellNode.appendChild(this.document.createTextNode(suite.name));
		rowNode.className = 'suite';
		rowNode.appendChild(cellNode);
		this.reportNode.appendChild(rowNode);

		if (this.indentLevel) {
			cellNode.className += ' indent' + Math.min(this.indentLevel, 5);
			rowNode.className += ' indent';
		}

		this.runningSuites[suite.id] = { node: rowNode };
		++this.indentLevel;
	}

	suiteEnd(suite: Suite) {
		function generateSummary(suite: Suite) {
			if (this.summaryNodes.length === 0) {
				return;
			}

			const duration = suite.timeElapsed;
			const percentPassed = Math.round((1 - (this.failCount / this.testCount || 0)) * 10000) / 100;
			const rowInfo = [
				this.suiteCount,
				this.testCount,
				formatDuration(duration),
				this.failCount,
				percentPassed + '%'
			];

			for (let i = 0; i < rowInfo.length; ++i) {
				this.summaryNodes[i].appendChild(this.document.createTextNode(String(rowInfo[i])));
			}

			// Create a toggle to only show failed tests
			if (this.failCount) {
				this.failedFilter = this.document.createElement('div');
				this.failedFilter.className = 'failedFilter';
				const failedToggle = this.document.createElement('input');
				failedToggle.id = 'failedToggle';
				failedToggle.type = 'checkbox';

				const failedLabel = this.document.createElement('label');
				failedLabel.htmlFor = 'failedToggle';
				failedLabel.innerHTML = 'Show only failed tests';

				this.failedFilter.appendChild(failedToggle);
				this.failedFilter.appendChild(failedLabel);

				const document = this.document;
				failedToggle.onclick = function () {
					if (this.checked) {
						document.body.className += ' hidePassed';
					}
					else {
						document.body.className = document.body.className.replace(/\bhidePassed\b/, ' ');
					}
				};
			}
		}

		function injectCSS() {
			// Prevent FOUC
			const style = this.document.createElement('style');
			style.innerHTML = 'body { visibility: hidden; }';

			const link = this.document.createElement('link');
			link.rel = 'stylesheet';
			link.href = require.toUrl('./html/html.css');

			this.document.head.appendChild(style);
			this.document.head.appendChild(link);
		}

		if (!suite.parent) {
			generateSummary.call(this, suite);
			injectCSS.call(this);

			this.document.body.innerHTML = '';
			this.document.body.className = '';
			this.document.body.appendChild(this.fragment);

			if (this.failedFilter) {
				const report = this.reportContainer.querySelector('.report');
				this.reportContainer.insertBefore(this.failedFilter, report);
			}
			else {
				const failedNode = this.document.querySelector('.failed');
				failedNode.className = 'summaryContent failed success';
			}

			// Skip for the top-level suite
			return;
		}

		const rowNode = this.runningSuites[suite.id].node;
		const numTests = suite.numTests;
		const numFailedTests = suite.numFailedTests;
		const numSkippedTests = suite.numSkippedTests;
		const passedTests = numTests - numFailedTests;

		// Test name cell
		const testsPassed = this.document.createElement('span');
		if (passedTests > 0) {
			testsPassed.className = 'success';
		}

		let cellNode = this.document.createElement('td');
		cellNode.appendChild(this.document.createTextNode('Passed: '));

		if (numFailedTests || numSkippedTests) {
			testsPassed.innerHTML = String(passedTests);
			cellNode.appendChild(testsPassed);

			if (numFailedTests) {
				const testsFailed = this.document.createElement('span');
				testsFailed.className = 'failed';
				testsFailed.innerHTML = 'Failed: ' + numFailedTests;
				cellNode.appendChild(testsFailed);
			}

			if (numSkippedTests) {
				const testsSkipped = this.document.createElement('span');
				testsSkipped.className = 'skipped';
				testsSkipped.innerHTML = 'Skipped: ' + numSkippedTests;
				cellNode.appendChild(testsSkipped);
			}
		}
		else {
			testsPassed.innerHTML = numTests + ' / ' + numTests;
			cellNode.appendChild(testsPassed);
		}

		cellNode.className = 'column-info';
		rowNode.appendChild(cellNode);

		// Duration cell
		cellNode = this.document.createElement('td');
		cellNode.className = 'numeric duration';
		cellNode.appendChild(this.document.createTextNode(formatDuration(suite.timeElapsed)));
		rowNode.appendChild(cellNode);

		--this.indentLevel;

		// Only update the global tracking variables for top-level suites
		if (!this.indentLevel) {
			this.testCount += numTests;
			this.failCount += numFailedTests;
		}

		delete this.runningSuites[suite.id];
	}

	testEnd(test: Test) {
		++this.testIndex;

		const rowNode = this.document.createElement('tr');

		// Status cell
		let cellNode = this.document.createElement('td');
		cellNode.className = 'testStatus';
		rowNode.appendChild(cellNode);

		cellNode = this.document.createElement('td');

		if (this.indentLevel) {
			cellNode.className += ' indent' + this.indentLevel;
		}

		cellNode.appendChild(this.document.createTextNode(test.name));
		rowNode.appendChild(cellNode);

		cellNode = this.document.createElement('td');
		cellNode.className = 'column-info';

		if (test.error) {
			rowNode.className = 'testResult failed';
			cellNode.appendChild(this.document.createTextNode(test.error.message));
		}
		else if (test.skipped != null) {
			rowNode.className = 'testResult skipped';
			cellNode.appendChild(this.document.createTextNode('Skipped: ' + (test.skipped || '(no message)')));
		}
		else {
			rowNode.className = 'testResult passed';
		}

		if (this.testIndex === this.testsInSuite) {
			rowNode.className = rowNode.className + ' lastTest';
		}

		rowNode.appendChild(cellNode);

		cellNode = this.document.createElement('td');
		cellNode.className = 'numeric duration';
		cellNode.appendChild(this.document.createTextNode(test.skipped ? 'Skipped' : formatDuration(test.timeElapsed)));
		rowNode.appendChild(cellNode);

		this.reportNode.appendChild(rowNode);
	}
}
