/**
 * XML output mostly conforms to:
 * http://stackoverflow.com/questions/4922867/junit-xml-format-specification-that-hudson-supports#9691131
 */
define([
	'dojo/has',
	'dojo/node!fs',
	'../XmlNode'
], function (has, fs, XmlNode) {
	var xmlReporter;
	var sessions = {};
	var clientType = 'client';

	var REPORT_FILE_NAME = 'report.xml';
	var CLIENT_SESSION_NAME = 'client';

	function writeReportFile(filename) {
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

		fs.writeFileSync(filename, report);
		console.log('Report saved to ' + filename);
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

			'/suite/error': function (suite) {
				var clientSessionName = this.clientSessionName || CLIENT_SESSION_NAME;
				var session = sessions[suite.sessionId || clientSessionName];
				var metaSuite = session.suites[suite.name];
				var suiteNode = metaSuite._xmlReportNode;

				suiteNode.attributes = { name: suite.name };

				var errorType;
				var error = suite.error;

				if (error.constructor) {
					errorType = error.constructor.name;
				}

				if (!errorType) {
					errorType = Object.prototype.toString.call(error);
					errorType = errorType.split(' ');
					errorType = errorType[1];
						errorType = errorType.replace(/]$/, '');
				}

				if (errorType === 'Object') {
					errorType = 'Error';
				}

				var failureNode = suiteNode.createNode('failure', {
					type: errorType,
					message: suite.message || error.message
				});

				failureNode.setContent(error.stack || '');
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
					var clientSessionName = this.clientSessionName || CLIENT_SESSION_NAME;
					if (!(clientSessionName in sessions)) {
						sessions[clientSessionName] = {
							reports: [],
							suites: {},
							activeSuite: null,
						};
					}
					session = sessions[clientSessionName];
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

				var clientSessionName = this.clientSessionName || CLIENT_SESSION_NAME;
				var session = sessions[suite.sessionId || clientSessionName];
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
				var clientSessionName = this.clientSessionName || CLIENT_SESSION_NAME;
				var session = sessions[test.sessionId || clientSessionName];
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
					writeReportFile(this.reportFileName || REPORT_FILE_NAME);
				}
			},

			'/runner/end': function () {
				writeReportFile(this.reportFileName || REPORT_FILE_NAME);
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
