define([
	'require',
	'../util',
], function (require, util) {
	function pad(value, size) {
		var padded = String(value);

		while (padded.length < size) {
			padded = '0' + padded;
		}

		return padded;
	}

	function containsClass(node, cls) {
		var classes = node.className.split(/\s+/);
		return classes.indexOf(cls) !== -1;
	}

	function addClass(node, cls) {
		var classes = node.className.split(/\s+/);
		if (classes.indexOf(cls) !== -1) {
			return;
		}

		classes.push(cls);
		node.className = classes.join(' ');
	}

	function removeClass(node, cls) {
		var classes = node.className.split(/\s+/);
		var index = classes.indexOf(cls);
		if (index === -1) {
			return;
		}

		classes.splice(index, 1);
		node.className = classes.join(' ');
	}

	// Format a millisecond value to m:ss.SSS
	// If duration is greater than 60 minutes, value will be HHHH:mm:ss.SSS
	// (the hours value will not be converted to days)
	function formatDuration(duration) {
		var hours = Math.floor(duration / 3600000);
		var minutes = Math.floor(duration / 60000) - (hours * 60);
		var seconds = Math.floor(duration / 1000) - (hours * 3600) - (minutes * 60);
		var milliseconds = duration - (hours * 3600000) - (minutes * 60000) - (seconds * 1000);
		var formattedValue = '';

		if (hours) {
			formattedValue = hours + ':';
			minutes = pad(minutes, 2);
		}

		formattedValue += minutes + ':' + pad(seconds, 2) + '.' + pad(milliseconds, 3);

		return formattedValue;
	}

	function HtmlReporter(config) {
		config = config || {};

		var document = config.document || window.document;

		var reportContainer = null;

		// Div element to hold buttons above the summary table
		var reportControls;

		// tbody element to append report rows to
		var reportNode;

		// tr element containing summary info
		var summaryNode;

		// Array of td elements in 'summaryNode'
		var summaryNodes = [];

		// Accumulator for total number of suites
		var suiteCount = 0;

		// Accumulator for total number of tests
		var testCount = 0;

		//Tests in the current suite
		var testsInSuite = 0;

		//Current test index
		var testIndex = 0;

		// ID's of tests that have been processed
		var processedTests = {};

		// Accumulator for total number of skipped tests
		var skippedCount = 0;

		// Accumulator for total number of failed tests
		var failCount = 0;

		var failedFilter = null;

		var fragment = document.createDocumentFragment();

		var indentLevel = 0;

		function generateSummary(suite) {
			if (summaryNodes.length === 0) {
				return;
			}

			var duration = suite.timeElapsed;
			var percentPassed = Math.round((1 - (failCount / testCount || 0)) * 10000) / 100;
			var rowInfo = [
				suiteCount,
				testCount,
				formatDuration(duration),
				skippedCount,
				failCount,
				percentPassed + '%'
			];

			var i;

			for (i = 0; i < rowInfo.length; ++i) {
				summaryNodes[i].appendChild(document.createTextNode(rowInfo[i]));
			}

			// Create a toggle to only show failed tests
			if (failCount) {
				failedFilter = document.createElement('div');
				failedFilter.className = 'failedFilter';
				var failedToggle = document.createElement('input');
				failedToggle.id = 'failedToggle';
				failedToggle.type = 'checkbox';

				var failedLabel = document.createElement('label');
				failedLabel.htmlFor = 'failedToggle';
				failedLabel.innerHTML = 'Show only failed tests';

				failedFilter.appendChild(failedToggle);
				failedFilter.appendChild(failedLabel);

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
			var style = document.createElement('style');
			style.innerHTML = 'body { visibility: hidden; }';

			var link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = require.toUrl('./html/html.css');

			document.head.appendChild(style);
			document.head.appendChild(link);
		}

		/**
		 * Set the collapsed state of a node and return the new state.
		 *
		 * @param {DOMNode} node A suite node
		 * @param {boolean} collapsed Set the collapsed state, or toggle if undefined
		 */
		function setCollapsed(node, collapsed) {
			function getIndentLevel(node) {
				// second child always has a class of indentN
				var child = node.children[1];

				// get the indentN class
				var indent = child.className.split(' ').filter(function(name) {
					return name.indexOf('indent') >= 0;
				})[0];

				return indent ? parseInt(indent.slice('indent'.length), 10) : 0;
			}

			var indentDelta;
			var initialIndent = getIndentLevel(node);

			// Use the given collapsed state or toggle the existing state
			collapsed = collapsed == null ? !containsClass(node, 'collapsed') : collapsed;
			if (collapsed) {
				addClass(node, 'collapsed');
			}
			else {
				removeClass(node, 'collapsed');
			}

			// node won't exist after the last test in a suite
			while ((node = node.nextSibling)) {
				indentDelta = getIndentLevel(node) - initialIndent;

				// Stop looping when we encounter a row that's not indented more than the suite being updated
				if (indentDelta === 0) {
					break;
				}

				// Child suites of the suite being updated should always be collapsed
				if (containsClass(node, 'suite')) {
					addClass(node, 'collapsed');
				}

				// Only show children one level under the suite being updated when expanding
				node.style.display = (!collapsed && indentDelta === 1) ? '' : 'none';
			}
		}

		var runningSuites = {};

		this.fatalError = function (error) {
			var htmlError = util.getErrorMessage(error).replace(/&/g, '&amp;').replace(/</g, '&lt;');
			var errorNode = document.createElement('div');
			errorNode.style.cssText = 'color: red; font-family: sans-serif;';
			errorNode.innerHTML = '<h1>Fatal error</h1>' +
				'<pre style="padding: 1em; background-color: #f0f0f0;">' + htmlError + '</pre>';
			document.body.appendChild(errorNode);
		};

		this.run = function () {
			/* jshint maxlen:false */

			reportContainer = document.createElement('div');
			var headerNode = document.createElement('h1');
			var tableNode;
			var tmpNode;
			var rowNode;
			var cellNode;
			var summaryHeaders = [
				'Suites',
				'Tests',
				'Duration',
				'Skipped',
				'Failed',
				'Success Rate'
			];
			var i;

			// Page header
			var headerTitle = document.createElement('span');
			headerTitle.className = 'headerTitle';
			headerTitle.innerHTML = 'Intern Test Report';

			headerNode.className = 'reportHeader';
			var headerLogo = document.createElement('img');
			headerLogo.className = 'headerLogo';
			headerLogo.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIIAAACACAMAAADwFUHEAAADAFBMVEUAAAAAAAAAAABVVVVAQEBmZmZVVVVtbW1gYGBVVVVmZmZdXV1qampiYmJtbW1mZmZwcHBpaWljY2Nra2tmZmZtbW1oaGhvb29qampwcHBsbGxoaGhtbW1qampvb29ra2twcHBsbGxxcXFtbW1qampubm5ra2tvb29sbGxwcHBtbW1xcXFubm5sbGxvb29tbW1wcHBtbW1wcHBubm5xcXFvb29tbW1vb29tbW1wcHBubm5wcHBvb29xcXFvb29tbW1wcHBubm5wcHBubm5xcXFvb29xcXFvb29ubm5wcHBubm5wcHBvb29xcXFvb29xcXFwcHBubm5wcHBwcHBvb29xcXFvb29ubm5xcXFwcHBvb29wcHBwcHBvb29xcXFwcHBubm5wcHBvb29wcHBvb29xcXFvb29xcXFwcHBvb29wcHBvb29wcHBvb29xcXFwcHBxcXFwcHBvb29wcHBvb29wcHBvb29xcXFwcHBxcXFwcHBvb29wcHBubm5wcHBwcHBwcHBxcXFwcHBvb29wcHBvb29xcXFwcHBwcHBvb29xcXFwcHBvb29wcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBvb29wcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBwcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBwcHBwcHBwcHBxcXFwcHBwcHBxcXFwcHBwcHBwcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBwcHBwcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBwcHBxcXFwcHBxcXFxcXFwcHBwcHBxcXFwcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBxcXFwcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBxcXFwcHBwcHBxcXFwcHBxcXFwcHBxcXFwcHBxcXFxcXFwcHBxcXFwcHBxcXFwcHBxcXFxcXFwcHBxcXFxcXFwcHBwcHBxcXFwcHBxcXFxcXFwcHBxcXFxcXFwcHBxcXF+cGExAAAA/3RSTlMAAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4/QEFCQ0RFRkdISUpLTE1O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';

			headerNode.appendChild(headerLogo);
			headerNode.appendChild(headerTitle);
			fragment.appendChild(headerNode);

			// Report container
			reportContainer.className = 'internReportContainer';
			fragment.appendChild(reportContainer);

			// Summary table
			tableNode = document.createElement('table');
			tableNode.className = 'summary';
			summaryNode = document.createElement('div');

			tmpNode = document.createElement('thead');
			rowNode = document.createElement('tr');
			for (i = 0; i < summaryHeaders.length; i++) {
				cellNode = document.createElement('td');

				var cellContent = document.createElement('div');
				cellContent.className = 'summaryContent ' +
					summaryHeaders[i].toLowerCase().replace(/\s(.)/g, function (_, char) {
						return char.toUpperCase();
					});

				var cellTitle = document.createElement('span');
				cellTitle.className = 'summaryTitle';
				cellTitle.appendChild(document.createTextNode(summaryHeaders[i]));

				var cellData = document.createElement('div');
				cellData.className = 'summaryData';

				summaryNodes[i] = document.createElement('span');
				summaryNode.appendChild(summaryNodes[i]);

				cellData.appendChild(summaryNodes[i]);
				cellContent.appendChild(cellTitle);
				cellContent.appendChild(cellData);
				cellNode.appendChild(cellContent);
				rowNode.appendChild(cellNode);
			}

			tmpNode.appendChild(rowNode);
			tableNode.appendChild(tmpNode);
			reportContainer.appendChild(tableNode);

			// Controls
			reportControls = document.createElement('div');
			reportControls.className = 'reportControls';
			reportControls.appendChild(document.createElement('div'));
			reportControls.appendChild(document.createElement('div'));
			reportContainer.appendChild(reportControls);

			// Report table
			tableNode = document.createElement('table');
			tableNode.className = 'report';
			reportNode = document.createElement('tbody');
			tableNode.appendChild(reportNode);
			reportContainer.appendChild(tableNode);
		};

		this.suiteStart = function (suite) {
			// There's a top-level Suite that contains all user-created suites
			// We want to skip it
			if (!suite.parent) {
				return;
			}

			testsInSuite = suite.tests.length;
			testIndex = 0;
			processedTests = {};

			var rowNode = document.createElement('tr');

			// Status cell
			var cellNode = document.createElement('td');
			cellNode.className = 'testStatus';
			rowNode.appendChild(cellNode);

			cellNode = document.createElement('td');

			suiteCount++;

			cellNode.className = 'title';
			cellNode.appendChild(document.createTextNode(suite.name));
			rowNode.className = 'suite';
			rowNode.appendChild(cellNode);
			reportNode.appendChild(rowNode);

			if (indentLevel) {
				cellNode.className += ' indent' + Math.min(indentLevel, 5);
				rowNode.className += ' indent';
			}

			runningSuites[suite.id] = { node: rowNode };
			++indentLevel;
		};

		this.suiteEnd = function (suite) {
			if (!suite.parent) {
				generateSummary(suite);

				injectCSS();

				document.body.innerHTML = '';
				document.body.className = '';
				document.body.appendChild(fragment);

				var expandToggle = document.createElement('div');
				expandToggle.className = 'linkButton';
				expandToggle.textContent = 'Expand/collapse all';
				reportControls.firstElementChild.appendChild(expandToggle);

				expandToggle.addEventListener('click', function(event) {
					var shouldExpand = reportNode.querySelector('.collapsed') != null;
					var suites = reportNode.querySelectorAll('.suite');
					for (var i = 0; i < suites.length; i++) {
						setCollapsed(suites[i], !shouldExpand);
					}
				});

				if (failedFilter) {
					reportControls.lastElementChild.appendChild(failedFilter);
				}
				else {
					var failedNode = document.querySelector('.failed');
					failedNode.className = 'summaryContent failed success';
				}

				// Skip for the top-level suite
				return;
			}

			var rowNode = runningSuites[suite.id].node;
			var numTests = suite.numTests;
			var numFailedTests = suite.numFailedTests;
			var numSkippedTests = suite.numSkippedTests;
			var numPassedTests = numTests - numFailedTests - numSkippedTests;

			// Mark a suite as failed if any of its child tests failed, and 
			addClass(rowNode, numFailedTests > 0 ? 'failed' : 'passed');

			// Only suites with failed tests will be initially expanded
			setCollapsed(rowNode, numFailedTests === 0);

			var cellNode = document.createElement('td');

			if (numPassedTests > 0) {
				cellNode.appendChild(document.createTextNode('Passed: '));
				var testsPassed = document.createElement('span');
				testsPassed.className = 'success';
				testsPassed.innerHTML = numPassedTests;
				cellNode.appendChild(testsPassed);
			}

			if (numFailedTests > 0) {
				cellNode.appendChild(document.createTextNode('Failed: '));
				var testsFailed = document.createElement('span');
				testsFailed.className = 'failed';
				testsFailed.innerHTML = numFailedTests;
				cellNode.appendChild(testsFailed);
			}

			if (numSkippedTests > 0) {
				cellNode.appendChild(document.createTextNode('Skipped: '));
				var testsSkipped = document.createElement('span');
				testsSkipped.innerHTML = numSkippedTests;
				cellNode.appendChild(testsSkipped);
			}

			rowNode.addEventListener('click', function(event) {
				setCollapsed(event.currentTarget);
			});

			cellNode.className = 'column-info';
			rowNode.appendChild(cellNode);

			// Duration cell
			cellNode = document.createElement('td');
			cellNode.className = 'numeric duration';
			cellNode.appendChild(document.createTextNode(formatDuration(suite.timeElapsed)));
			rowNode.appendChild(cellNode);

			--indentLevel;

			// Only update the global tracking variables for top-level suites
			if (!indentLevel) {
				testCount += numTests;
				failCount += numFailedTests;
				skippedCount += numSkippedTests;
			}

			runningSuites[suite.id] = null;
		};

		this.testEnd = this.testSkip = function (test) {
			if (test.id in processedTests) {
				return;
			}

			processedTests[test.id] = true;

			testIndex++;

			var rowNode = document.createElement('tr');

			// Status cell
			var cellNode = document.createElement('td');
			cellNode.className = 'testStatus';
			rowNode.appendChild(cellNode);

			cellNode = document.createElement('td');

			if (indentLevel) {
				cellNode.className += ' indent' + indentLevel;
			}

			cellNode.appendChild(document.createTextNode(test.name));
			rowNode.appendChild(cellNode);

			cellNode = document.createElement('td');
			cellNode.className = 'column-info';

			if (test.error) {
				rowNode.className = 'testResult failed';
				cellNode.appendChild(document.createTextNode(test.error.message));
			}
			else if (test.skipped != null) {
				rowNode.className = 'testResult skipped';
				cellNode.appendChild(document.createTextNode(test.skipped || ''));
			}
			else {
				rowNode.className = 'testResult passed';
			}

			if (testIndex === testsInSuite) {
				rowNode.className = rowNode.className + ' lastTest';
			}

			rowNode.appendChild(cellNode);

			cellNode = document.createElement('td');
			cellNode.className = 'numeric duration';
			cellNode.appendChild(document.createTextNode(test.skipped ? 'Skipped' : formatDuration(test.timeElapsed)));
			rowNode.appendChild(cellNode);

			reportNode.appendChild(rowNode);
		};
	}

	var collapsedTest = /\bcollapsed\b/;

	return HtmlReporter;
});
