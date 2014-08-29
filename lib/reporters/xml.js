/**
 * XML output mostly conforms to:
 * http://stackoverflow.com/questions/4922867/junit-xml-format-specification-that-hudson-supports#9691131
 */
define([
	'dojo/node!fs'
], function (fs) {
	var sessions = {};
	var CLIENT_SESSION = 'client';

	/**
	 * Simple XML generator.
	 * @constructor
	 * @param {string} nodeName The node name.
	 * @param {Object?} attributes Optional attributes.
	 */
	function XmlNode(nodeName, attributes) {
		this.nodeName = nodeName;
		this.childNodes = [];
		this.attributes = attributes || {};
	}

	XmlNode.prototype = {
		constructor: XmlNode,
		nodeName: '',
		childNodes: [],
		attributes: {},

		/**
		 * Creates a new XML node and pushes it to the end of the current node.
		 * @param {string} nodeName The node name for the new node.
		 * @param {Object?} attributes Optional attributes for the new node.
		 * @returns {XmlNode} A new node.
		 */
		createNode: function (nodeName, attributes) {
			var node = new XmlNode(nodeName, attributes);
			if (this._hasContent) {
				this.childNodes = [];
				this._hasContent = false;
			}
			this.childNodes.push(node);
			return node;
		},

		/**
		 * @param {string} content
		 */
		setContent: function (content) {
			this.childNodes = [content];
			this._hasContent = true;
		},

		_escape: function (string) {
			return string.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
		},

		_printAttributes: function (attributes) {
			var nodes = [];

			for (var key in attributes) {
				if (attributes.hasOwnProperty(key) && attributes[key] != null) {
					nodes.push(key + '="' + this._escape(attributes[key]) + '"');
				}
			}

			return nodes.length ? ' ' + nodes.join(' ') : '';
		},

		_printChildren: function (nodeList) {
			var nodes = [];
			for (var i = 0, j = nodeList.length; i < j; ++i) {
				nodes.push(typeof nodeList[i] === 'string' ? this._escape(nodeList[i]) : nodeList[i].toString());
			}

			return nodes.join('');
		},

		/**
		 * Outputs the node as a serialised XML string.
		 * @returns {string}
		 */
		toString: function () {
			var children = this._printChildren(this.childNodes);

			return '<' + this.nodeName + this._printAttributes(this.attributes) +
				(children.length ? '>' + children + '</' + this.nodeName + '>' : '/>');
		}
	};

	/**
	 * Write the current XML report to a file.
	 */
	function writeReportFile() {
		var rootNode = new XmlNode('testsuites');

		for (var sessionId in sessions) {
			var session = sessions[sessionId];

			for (var i = 0; i < session.reports.length; i++) {
				var suiteNode = session.reports[i];

				if (session.remote) {
					var environment = session.remote.environmentType.browserName + ' ' +
						session.remote.environmentType.version + ', ' +
						session.remote.environmentType.platform;

					suiteNode.attributes.id = suiteNode.attributes.name + ' (' + environment + ')';
					suiteNode.createNode('properties').createNode('property', {
						name: 'environment',
						value: environment
					});
				}

				rootNode.childNodes.push(suiteNode);
			}
		}

		var report = '<?xml version="1.0" encoding="UTF-8" ?>' + rootNode.toString();
		fs.writeFileSync('report.xml', report);
	}

	/**
	 * Get a canonical type name for an error.
	 */
	function getErrorType(error) {
		if (error.constructor && error.constructor.name) {
			return error.constructor.name;
		}

		var errorType = Object.prototype.toString.call(error);
		errorType = errorType.split(' ')[1].replace(/]$/, '');

		if (errorType === 'Object') {
			errorType = 'Error';
		}

		return errorType;
	}

	return {
		'/session/start': function (remote) {
			sessions[remote.sessionId] = {
				reports: [],
				suites: {},
				remote: remote,
				activeSuite: null
			};
		},

		'/suite/start': function (suite) {
			if (suite.name === 'main') {
				return;
			}

			// When using the remote runner, the arguments for /suite/end and /test/end will be serialized from the
			// client, so there won't be valid references to parent suites. Therefore we have to manually track
			// information about the currently active suite for each session.
			var sessionSuite = {};
			var session;
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

			session.suites[suite.name] = sessionSuite;

			if (session.activeSuite) {
				parent = sessionSuite.parent = session.activeSuite;
			}

			session.activeSuite = sessionSuite;

			// Handle nested suites
			if (parent && parent._xmlReportNode) {
				sessionSuite._xmlReportNode = parent._xmlReportNode.createNode('testsuite');
			}
			else {
				sessionSuite._xmlReportNode = new XmlNode('testsuite');
				session.reports.push(sessionSuite._xmlReportNode);
			}

			sessionSuite._startTime = Number(new Date());
		},

		'/suite/error': function (suite) {
			var session = sessions[suite.sessionId || CLIENT_SESSION];
			var sessionSuite = session.suites[suite.name];
			var suiteNode = sessionSuite._xmlReportNode;
			var error = suite.error;

			suiteNode.attributes = { name: suite.name };

			var failureNode = suiteNode.createNode('failure', {
				type: getErrorType(error),
				message: suite.message || error.message
			});

			failureNode.setContent(error.stack || '');
		},

		'/suite/end': function (suite) {
			if (suite.name === 'main') {
				return;
			}

			var session = sessions[suite.sessionId || CLIENT_SESSION];
			var sessionSuite = session.suites[suite.name];

			sessionSuite._xmlReportNode.attributes = {
				name: suite.name,
				tests: String(suite.numTests),
				failures: String(suite.numFailedTests),
				time: String((Number(new Date()) - sessionSuite._startTime) / 1000)
			};

			if (sessionSuite.parent) {
				session.activeSuite = sessionSuite.parent;
			}
			else {
				session.activeSuite = null;
			}
		},

		'/test/end': function (test) {
			var session = sessions[test.sessionId || CLIENT_SESSION];

			var testNode = session.activeSuite._xmlReportNode.createNode('testcase', {
				name: test.name,
				time: String(test.timeElapsed / 1000)
			});

			if (test.error) {
				var failureNode = testNode.createNode('failure', {
					type: getErrorType(test.error),
					message: test.message || test.error.message
				});

				failureNode.setContent(test.error.stack || '');
			}
		},

		stop: function () {
			writeReportFile();
		}
	};
});
