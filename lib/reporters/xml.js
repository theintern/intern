/**
 * XML output mostly conforms to:
 * http://stackoverflow.com/questions/4922867/junit-xml-format-specification-that-hudson-supports#9691131
 */
define([
	'dojo/has',
	'dojo/node!fs',
	'../XmlNode'
], function (has, fs, XmlNode) {
	var REPORT_FILE_NAME = 'report.xml';
	var CLIENT_SESSION = 'client';

	var xmlReporter;
	var sessions = {};
	var clientType = 'client';

	function writeReportFile() {
		var report = '<?xml version="1.0" encoding="UTF-8" ?>';
		var rootNode = new XmlNode('testsuites');
		var sessionId;
		var session;
		var suiteNode;
		var i;

		for (sessionId in sessions) {
			session = sessions[sessionId];

			for (i = 0; i < session.reports.length; i++) {
				suiteNode = session.reports[i];

				if (session.environment) {
					suiteNode.attributes.id = suiteNode.attributes.name + ' (' + session.environment + ')';
					suiteNode.createNode('properties').createNode('property', {
						name: 'environment',
						value: session.environment
					});
				}

				rootNode.childNodes.push(suiteNode);
			}
		}

		report += rootNode.toString();

		fs.writeFile(REPORT_FILE_NAME, report, function (error) {
			if (error) {
				throw error;
			}
			console.log('Report saved to ' + REPORT_FILE_NAME);
		});
	}


	if (has('host-node')) {
		xmlReporter = {
			'/session/start': function (remote) {
				clientType = 'runner';
				sessions[remote.sessionId] = {
					reports: [],
					suites: {},
					activeSuite: null,
					environment: remote.environmentType.browserName + ' ' +
						remote.environmentType.version + ', ' +
						remote.environmentType.platform
				};
			},

			'/error': function (error) {
				throw error;
			},

			'/suite/start': function (suite) {
				if (suite.name === 'main') {
					return;
				}

				var session;
				// The object passed as the 'suite' parameter in /suite/start is not guaranteed to be the same as the
				// one passed in to /suite/end, so maintain a meta-suite object keyed off the suite name
				var metaSuite = {};
				var parent;

				if (suite.sessionId) {
					session = sessions[suite.sessionId];
				}
				else {
					if (!(CLIENT_SESSION in sessions)) {
						sessions[CLIENT_SESSION] = {
							reports: [],
							suites: {},
							activeSuite: null,
						};
					}
					session = sessions[CLIENT_SESSION];
				}

				session.suites[suite.name] = metaSuite;

				if (session.activeSuite) {
					parent = session.activeSuite;
					metaSuite.parent = parent;
				}

				session.activeSuite = metaSuite;

				// Handle nested suites
				if (parent && parent._xmlReportNode) {
					metaSuite._xmlReportNode = parent._xmlReportNode.createNode('testsuite');
				}
				else {
					metaSuite._xmlReportNode = new XmlNode('testsuite');
					session.reports.push(metaSuite._xmlReportNode);
				}

				metaSuite._startTick = (new Date()).getTime();
				
			},

			'/suite/end': function (suite) {
				if (suite.name === 'main') {
					return;
				}

				var session = sessions[suite.sessionId || CLIENT_SESSION];
				var metaSuite = session.suites[suite.name];
				var endTick = (new Date()).getTime();
				var suiteNode = metaSuite._xmlReportNode;
				var numTests = suite.numTests;
				var numFailedTests = suite.numFailedTests;

				suiteNode.attributes = {
					name: suite.name,
					tests: String(numTests),
					failures: String(numFailedTests),
					time: String((endTick - metaSuite._startTick) / 1000)
				};

				if (metaSuite.parent) {
					session.activeSuite = metaSuite.parent;
				}
				else {
					session.activeSuite = null;
				}

				metaSuite._startTick = null;
			},

			'/test/end': function (test) {
				var session = sessions[test.sessionId || CLIENT_SESSION];
				var suiteNode = session.activeSuite._xmlReportNode;
				var testNode;
				var failureNode;
				var errorType;

				testNode = suiteNode.createNode('testcase', {
					name: test.name,
					time: String(test.timeElapsed / 1000)
				});

				if (test.error) {
					if (test.error.constructor && test.error.constructor.name) {
						errorType = test.error.constructor.name;
					}

					if (!errorType) {
						errorType = Object.prototype.toString.call(test.error);
						errorType = errorType.split(' ');
						errorType = errorType[1];
							errorType = errorType.replace(/]$/, '');
					}

					if (errorType === 'Object') {
						errorType = 'Error';
					}

					failureNode = testNode.createNode('failure', {
						type: errorType,
						message: test.message || test.error.message
					});

					failureNode.setContent(test.error.stack || '');
				}
			},

			'/client/end': function () {
				if (clientType === 'client') {
					writeReportFile();
				}
			},

			'/runner/end': function () {
				writeReportFile();
			}
		};
	}
	else {
		xmlReporter = {
			start: function () {
				throw new Error('The XML reporter only works with Node.js');
			}
		};
	}

	return xmlReporter;
});
