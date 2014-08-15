define([
	'require',
], function (require) {
	var reportContainer = null;

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

	// Accumulator for total number of failed tests
	var failCount = 0;

	// Clock tick for start of reporter's "start" method
	var startTick = 0;

	var failedFilter = null;

	var fragment = document.createDocumentFragment();
	var indentLevel = 0;

	// Pad 'val' with leading zeroes up to 'size' length
	function pad(val, /* integer */ size) {
		var padded = String(val);

		while (padded.length < size) {
			padded = '0' + padded;
		}

		return padded;
	}

	function addClass(node, newClass) {
		var cls = node.className;
		cls = cls ? cls + ' ' : '';
		node.className = cls + newClass;
	}

	// Format a millisecond value to m:ss.SSS
	// If duration is greater than 60 minutes, value will be
	// HHHH:mm:ss.SSS
	// (the hours value will not be converted to days)
	function formatDuration(/* integer */ duration) {
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

	function renderSummary() {
		if (summaryNodes.length === 0) {
			return;
		}

		var duration = (new Date()).getTime() - startTick;
		var percentPassed = Math.round((1 - (failCount / testCount)) * 10000) / 100;
		var rowInfo = [
			suiteCount,
			testCount,
			formatDuration(duration),
			failCount,
			percentPassed + '%'
		];

		var i;

		for (i = 0; i < rowInfo.length; i++) {
			summaryNodes[i].appendChild(document.createTextNode(rowInfo[i]));
		}

		//Create a toggle to only show failed tests
		if(failCount) {
			failedFilter = document.createElement('div');
			failedFilter.className = "failedFilter";
			failedToggle = document.createElement('input');
			failedToggle.id = "failedToggle";
			failedToggle.type="checkbox";

			failedLabel = document.createElement('label');
			failedLabel.htmlFor = "failedToggle";
			failedLabel.innerHTML="Show only failed tests";

			failedFilter.appendChild(failedToggle);
			failedFilter.appendChild(failedLabel);

			failedToggle.onclick = function() {
				var passedElements = document.getElementsByClassName('passed');
				if(this.checked) {
					for(var i=0; i<=passedElements.length; i++) {
						addClass(passedElements[i], 'hidden');
					}
				} else {
					for(var i=0; i<=passedElements.length; i++) {
						passedElements[i].classList.remove('hidden');
					}
				}
			}
		}
	}

	function injectCSS() {
		var link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = require.toUrl('./html.css');
		(document.head || document.getElementsByTagName('head')[0]).appendChild(link);
	}


	var htmlReporter = {
		start: function () {
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
				'Failed',
				'Success Rate'
			];
			var i;


			// Page header
			var headerTitle = document.createElement('span');
			headerTitle.className = "headerTitle";
			headerTitle.innerHTML = 'Intern Test Report';

			headerNode.className = 'reportHeader';
			var headerLogo = document.createElement('img');
			headerLogo.className='headerLogo';
			headerLogo.src = 'lib/reporters/html_assets/images/internLogo.png';

			headerNode.appendChild(headerLogo);
			headerNode.appendChild(headerTitle);
			fragment.appendChild(headerNode);

			//Report Container
			reportContainer.className = "internReportContainer";
			fragment.appendChild(reportContainer);


			// Summary table
			tableNode = document.createElement('table');
			tableNode.className = 'summary';
			summaryNode = document.createElement('div');

			tmpNode = document.createElement('thead');
			rowNode = document.createElement('tr');
			for (i = 0; i < summaryHeaders.length; i++) {
				cellNode = document.createElement('td');

				cellContent = document.createElement("div");
				cellContent.className = "summaryContent "+summaryHeaders[i].toLowerCase();

				var cellTitle = document.createElement('span');
				cellTitle.className = "summaryTitle";
				cellTitle.innerHTML = summaryHeaders[i];

				var cellData = document.createElement('div');
				cellData.className = "summaryData";

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

			// Report table
			tableNode = document.createElement('table');
			tableNode.className = 'report';
			reportNode = document.createElement('tbody');
			tableNode.appendChild(reportNode);
			reportContainer.appendChild(tableNode);

			startTick = (new Date()).getTime();
		},

		'/suite/start': function (suite) {
			// There's a top-level Suite (named 'main') that contains all user-created suites
			// We want to skip it
			if (!suite.parent) {
				return;
			}

			testsInSuite = suite.tests.length;
			testIndex = 0;

			var rowNode = document.createElement('tr');

			//Status Cell
			var cellNode = document.createElement('td');
			cellNode.className = "testStatus";
			rowNode.appendChild(cellNode);

			var cellNode = document.createElement('td');

			suiteCount++;
			suite._startTick = (new Date()).getTime();

			cellNode.className = 'title';
			cellNode.innerHTML = suite.name;
			rowNode.className = 'suite';
			rowNode.appendChild(cellNode);
			reportNode.appendChild(rowNode);

			if (indentLevel) {
				addClass(cellNode, 'indent' + indentLevel);
				addClass(rowNode, 'indent');
			}

			suite._htmlReportNode = rowNode;
			indentLevel++;
		},

		'/suite/end': function (suite) {
			if(!suite.parent){
				renderSummary();

				injectCSS();

				document.body.innerHTML = '';

				document.body.appendChild(fragment);
				if(failedFilter) {
					var report = reportContainer.getElementsByClassName("report")[0];
					reportContainer.insertBefore(failedFilter, report);
				} else {
					var failedNode = document.querySelectorAll('.failed');
					failedNode[0].className = "summaryContent failed success";

				}

				// Skip '/suite/end' for the top-level 'main' suite
				return;
			}

			var rowNode = suite._htmlReportNode;
			var endTick = (new Date()).getTime();
			var numTests = suite.numTests;
			var numFailedTests = suite.numFailedTests;
			var testInfo;
			var passedTests = numTests - numFailedTests;

			// Test name cell
			var testsPassed = document.createElement('span');
			if(passedTests > 0) {
				testsPassed.className = 'success';
			}

			var cellNode = document.createElement('td');
			cellNode.appendChild(document.createTextNode('Passed: '));

			if(numFailedTests) {
				testsPassed.innerHTML = passedTests;

				var testsFailed = document.createElement('span');
				testsFailed.className = 'failed';
				testsFailed.innerHTML = 'Failed: '+numFailedTests;

				cellNode.appendChild(testsPassed);
				cellNode.appendChild(testsFailed);
			} else {
				testsPassed.innerHTML = numTests + ' / ' + numTests;
				cellNode.appendChild(testsPassed);
			}

			cellNode.className = 'column-info';
			rowNode.appendChild(cellNode);

			//Duration cell
			cellNode = document.createElement('td');
			cellNode.className = 'numeric duration';
			cellNode.appendChild(document.createTextNode(formatDuration(endTick - suite._startTick)));
			rowNode.appendChild(cellNode);

			indentLevel--;

			// Only update the global tracking variables for top-level suites
			if (!indentLevel) {
				testCount += numTests;
				failCount += numFailedTests;
			}

			suite._startTick = null;
			suite._htmlReportNode = null;
		},

		'/test/end': function (test) {
			testIndex++;

			var rowNode = document.createElement('tr');

			//Status Cell
			var cellNode = document.createElement('td');
			cellNode.className = "testStatus";
			rowNode.appendChild(cellNode);


			var cellNode = document.createElement('td');

			if (indentLevel) {
				addClass(cellNode, 'indent' + indentLevel);
			}

			cellNode.appendChild(document.createTextNode(test.name));
			rowNode.appendChild(cellNode);

			cellNode = document.createElement('td');
			cellNode.className = 'column-info';
			if (test.error) {
				rowNode.className = 'testResult failed';
				cellNode.appendChild(document.createTextNode(test.error.message));
			} else {
				rowNode.className = 'testResult passed';
			}

			if(testIndex == testsInSuite) {
				rowNode.className = rowNode.className + ' lastTest';
			}

			rowNode.appendChild(cellNode);

			cellNode = document.createElement('td');
			cellNode.className = 'numeric duration';
			cellNode.appendChild(document.createTextNode(formatDuration(test.timeElapsed)));
			rowNode.appendChild(cellNode);

			reportNode.appendChild(rowNode);
		}
	};

	return htmlReporter;
});
