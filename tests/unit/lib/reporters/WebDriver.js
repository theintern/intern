define([
	'intern!object',
	'intern/chai!assert',
	'dojo/Promise',
	'../../../../lib/Suite',
	'../../../../lib/Test',
	'./support/mockRequest'
], function (registerSuite, assert, Promise, Suite, Test, mockRequest) {

	var WebDriver;

	registerSuite({
		name: 'intern/lib/reporters/WebDriver',

		setup: function () {
			return new Promise(function (resolve) {
				require({
					map: {
						'intern-selftest/lib/reporters/WebDriver': {
							'dojo': 'intern-selftest/node_modules/dojo',
							'dojo/request': 'intern-selftest/tests/unit/lib/reporters/support/mockRequest'
						}
					}
				}, [ 'intern-selftest/lib/reporters/WebDriver' ], function (_WebDriver) {
					WebDriver = _WebDriver;
					resolve();
				});
			});
		},

		runStart: function () {
			var reporter = new WebDriver({
				internConfig: {
					sessionId: 'foo'
				}
			});

			reporter.runStart();

			var req = mockRequest._callStack.pop();
			var data = JSON.parse(req[1].data);
			assert.strictEqual(req[0], reporter.url, 'Data posted to an URI');
			assert.strictEqual(data.payload[0], 'runStart',
				'The type of the payload should be "runStart"');
		},

		runEnd: function () {
			var reporter = new WebDriver({
				internConfig: {
					sessionId: 'foo'
				}
			});

			reporter.runEnd();

			var req = mockRequest._callStack.pop();
			var data = JSON.parse(req[1].data);
			assert.strictEqual(req[0], reporter.url, 'Data posted to an URI');
			assert.strictEqual(data.payload[0], 'runEnd',
				'The type of the payload should be "runEnd"');
		},

		suiteStart: function () {
			var reporter = new WebDriver({
				internConfig: {
					sessionId: 'foo'
				}
			});
			var suite = new Suite({ name: 'suite', parent: {} });

			reporter.suiteStart(suite);

			var req = mockRequest._callStack.pop();
			var data = JSON.parse(req[1].data);
			assert.strictEqual(req[0], reporter.url, 'Data posted to an URI');
			assert.strictEqual(data.payload[0], 'suiteStart',
				'The type of the payload should be "suiteStart"');
			assert.strictEqual(reporter.suiteNode, reporter.reporterNode.lastChild,
				'The suiteNode should be the lastChild of the reporterNode');
			assert.strictEqual(reporter.suiteNode.tagName, 'OL',
				'The suiteNode should be an <ol> element');
		},

		suiteEnd: {
			'successful suite': function () {
				var reporter = new WebDriver({
					internConfig: {
						sessionId: 'foo'
					}
				});
				var test = new Test({ hasPassed: true });
				var suite = new Suite({ name: 'suite', tests: [ test ] });
				test.parent = suite;

				reporter.suiteEnd(suite);
				var req = mockRequest._callStack.pop();
				var data = JSON.parse(req[1].data);
				assert.strictEqual(req[0], reporter.url, 'Data posted to an URI');
				assert.strictEqual(data.payload[0], 'suiteEnd',
					'The type of the payload should be "suiteEnd"');
				assert.strictEqual(data.payload[1].name, suite.name,
					'The name of the suite should match the payload');
				assert.strictEqual(data.payload[1].numTests, 1,
					'The number of tests should be correct');
				assert.strictEqual(data.payload[1].numFailedTests, 0,
					'There should be no failed tests');
				assert.strictEqual(this.suiteNode, this.reporterNode,
					'The suiteNode should have been reset');
			},

			'failed suite': function () {
				var reporter = new WebDriver({
					internConfig: {
						sessionId: 'foo'
					}
				});
				var test = new Test({ hasPassed: false });
				var suite = new Suite({ name: 'suite', tests: [ test ] });
				test.parent = suite;

				reporter.suiteEnd(suite);
				var req = mockRequest._callStack.pop();
				var data = JSON.parse(req[1].data);
				assert.strictEqual(data.payload[1].numFailedTests, 1,
					'There should be one failed tests');
				assert.strictEqual(this.suiteNode, this.reporterNode,
					'The suiteNode should have been reset');
			},

			'reset of body': function () {
				var reporter = new WebDriver({
					internConfig: {
						sessionId: 'foo'
					}
				});
				var test = new Test({
					name: 'test',
					timeElapsed: 123,
					parent: { name: 'parent', id: 'parent' },
					hasPassed: true
				});
				var suite = new Suite({ name: 'suite', tests: [ test ] });

				reporter.suiteStart(suite);
				reporter.testStart(test);

				while (document.body.firstChild) {
					document.body.removeChild(document.body.firstChild);
				}

				reporter.testPass(test);

				reporter.suiteEnd(suite);

				assert.strictEqual(reporter.reporterNode.parentNode, document.body,
					'The reporterNode should be a child of the body');
			},

			'contained suites': function () {
				var reporter = new WebDriver({
					internConfig: {
						sessionId: 'foo'
					}
				});

				var test = new Test({
					name: 'test',
					timeElapsed: 123,
					parent: { name: 'parent', id: 'parent' },
					hasPassed: true
				});
				var parentSuite = new Suite({ name: 'parentSuite' });
				var suite = new Suite({ name: 'suite', parent: parentSuite });

				reporter.suiteStart(parentSuite);
				reporter.suiteStart(suite);
				assert.strictEqual(reporter.reporterNode.lastChild, reporter.suiteNode.parentNode.parentNode);
				assert.strictEqual(suite.name, reporter.suiteNode.parentNode.firstChild.innerText ||
					reporter.suiteNode.parentNode.firstChild.textContent,
					'Title of section should be name of suite');
				assert.strictEqual(reporter.suiteNode.parentNode.tagName, 'LI',
					'Suite Node parent should be a <li> element');
				reporter.testStart(test);
				reporter.testPass(test);
				reporter.suiteEnd(suite);
				assert.strictEqual(reporter.suiteNode.parentNode, reporter.reporterNode,
					'suiteNode parent should equal reporterNode');
				reporter.suiteEnd(parentSuite);
				assert.strictEqual(reporter.reporterNode, reporter.suiteNode,
					'reporterNode and suiteNode should be equal');
			}
		},

		testStart: function () {
			var reporter = new WebDriver({
				internConfig: {
					sessionId: 'foo'
				}
			});
			var test = new Test({
				name: 'test',
				timeElapsed: 123,
				parent: { name: 'parent', id: 'parent' },
				hasPassed: true
			});

			reporter.testStart(test);
			var req = mockRequest._callStack.pop();
			var data = JSON.parse(req[1].data);
			assert.strictEqual(req[0], reporter.url, 'Data posted to an URI');
			assert.strictEqual(data.payload[0], 'testStart',
				'The type of the payload should be "testStart"');
			assert.strictEqual(data.payload[1].id, test.id,
				'IDs of the test and the payload should match');
			assert.strictEqual(reporter.testNode.tagName, 'LI',
				'testNode should be <li> element');
			assert.strictEqual(reporter.testNode, reporter.suiteNode.lastChild,
				'testNode should be the last child of the suiteNode');
		},

		testPass: function () {
			var reporter = new WebDriver({
				internConfig: {
					sessionId: 'foo'
				}
			});
			var test = new Test({
				name: 'test',
				timeElapsed: 123,
				parent: { name: 'parent', id: 'parent' },
				hasPassed: true
			});

			reporter.testStart(test);
			reporter.testPass(test);
			var req = mockRequest._callStack.pop();
			var data = JSON.parse(req[1].data);
			assert.strictEqual(req[0], reporter.url, 'Data posted to an URI');
			assert.strictEqual(data.payload[0], 'testPass',
				'The type of the payload should be "testPass"');
			assert.include(reporter.testNode.lastChild.wholeText, test.timeElapsed + 'ms',
				'Test text should include duration of the test');
			assert.include(reporter.testNode.lastChild.wholeText, test.name,
				'Test should include the name of the test');
			assert.include(reporter.testNode.lastChild.wholeText, 'passed',
				'Test should include that it passed');
			assert.strictEqual(reporter.testNode.style.color, 'green',
				'Test node should be green');
		},

		testSkip: function () {
			var reporter = new WebDriver({
				internConfig: {
					sessionId: 'foo'
				}
			});
			var test = new Test({
				name: 'test',
				timeElapsed: 123,
				parent: { name: 'parent', id: 'parent' },
				hasPassed: true,
				skipped: 'Because'
			});
			var test2 = new Test({
				name: 'test2',
				timeElapsed: 123,
				parent: { name: 'parent', id: 'parent' },
				hasPassed: true
			});

			reporter.testSkip(test);
			var req = mockRequest._callStack.pop();
			var data = JSON.parse(req[1].data);
			assert.strictEqual(req[0], reporter.url, 'Data posted to an URI');
			assert.strictEqual(data.payload[0], 'testSkip',
				'The type of the payload should be "testSkip"');
			assert.include(reporter.testNode.lastChild.wholeText, test.name,
				'Test should include the name of the test');
			assert.include(reporter.testNode.lastChild.wholeText, 'skipped',
				'Test should include that it skipped');
			assert.include(reporter.testNode.lastChild.wholeText, '(' + test.skipped + ')',
				'Test should include the reason why it was skipped');
			assert.strictEqual(reporter.testNode.style.color, 'gray',
				'Test node should be gray');

			reporter.testSkip(test2);
			assert.notInclude(reporter.testNode.lastChild.wholeText, '(',
				'Should not include a skipped reason');
		},

		testFail: function () {
			var reporter = new WebDriver({
				internConfig: {
					sessionId: 'foo'
				}
			});
			var test = new Test({
				name: 'test',
				timeElapsed: 123,
				parent: { name: 'parent', id: 'parent' },
				error: new Error('Ooops')
			});

			reporter.testStart(test);
			reporter.testFail(test);
			var req = mockRequest._callStack.pop();
			var data = JSON.parse(req[1].data);
			assert.strictEqual(req[0], reporter.url, 'Data posted to an URI');
			assert.strictEqual(data.payload[0], 'testFail',
				'The type of the payload should be "testFail"');
			var errorMessage = reporter.testNode.lastChild;
			var testTextNode = errorMessage.previousSibling;
			assert.include(testTextNode.wholeText, test.name,
				'Test should include the name of the test');
			assert.include(testTextNode.wholeText, 'failed',
				'Test should include that it skipped');
			assert.include(testTextNode.wholeText, test.timeElapsed + 'ms',
				'Test should include its duration');
			assert.strictEqual(reporter.testNode.style.color, 'red',
				'Test node should be red');
			assert.strictEqual(errorMessage.firstChild.wholeText, test.error.stack || test.error.toString(),
				'The reporter error message should match the test error message');
		},

		'config.writeHtml false': function () {
			var numberOfChildNodes = document.querySelectorAll('body > *').length;
			var callStackDepth = mockRequest._callStack.length;

			var reporter = new WebDriver({
				internConfig: {
					sessionId: 'foo'
				},
				writeHtml: false
			});
			var test = new Test({
				name: 'test',
				timeElapsed: 123,
				parent: { name: 'parent', id: 'parent' },
				hasPassed: true
			});
			var test2 = new Test({
				name: 'test2',
				timeElapsed: 123,
				parent: { name: 'parent', id: 'parent' },
				hasPassed: false
			});
			var test3 = new Test({
				name: 'test3',
				timeElapsed: 123,
				parent: { name: 'parent', id: 'parent' },
				error: new Error('Ooops')
			});
			var suite = new Suite({ name: 'suite', tests: [ test ] });

			reporter.suiteStart(suite);
			reporter.testStart(test);
			reporter.testPass(test);
			reporter.testSkip(test2);
			reporter.testStart(test3);
			reporter.testFail(test3);
			reporter.suiteEnd(suite);

			assert.strictEqual(document.querySelectorAll('body > *').length, numberOfChildNodes,
				'Reporter should not have added any nodes to the DOM');
			assert.strictEqual(mockRequest._callStack.length, callStackDepth + 7,
				'The appropriate number of events were posted.');
		},

		'config.waitForRunner': {
			'is true': function () {
				var dfd = this.async(250);
				var reporter = new WebDriver({
					internConfig: {
						sessionId: 'foo'
					},
					waitForRunner: true
				});
				var tests = [];
				var suite = new Suite({ name: 'suite', parent: {}, tests: tests });

				var suiteStartResult = reporter.suiteStart(suite);
				assert.isFunction(suiteStartResult.then, 'Promise should be returned');
				suiteStartResult.then(dfd.callback(function () {
					var suiteEndResult = reporter.suiteEnd(suite);
					assert.isFunction(suiteEndResult.then, 'Promise should be returned');
				}));
			},
			'is fail': function () {
				var reporter = new WebDriver({
					internConfig: {
						sessionId: 'foo'
					},
					waitForRunner: 'fail'
				});
				var suite = new Suite({ name: 'suite', parent: {}});
				var test = new Test({
					name: 'test',
					timeElapsed: 123,
					parent: suite,
					error: new Error('Ooops')
				});
				suite.tests = [ test ];

				assert.isUndefined(reporter.suiteStart(suite),
					'Should not return a Promise');
				assert.isUndefined(reporter.testStart(test),
					'Should not return a Promise');
				assert.isFunction(reporter.testFail(test).then,
					'Promise should be returned');
				assert.isUndefined(reporter.suiteEnd(suite),
					'Should not return a Promise');
			}
		},

		'$others': function () {
			var callStackDepth = mockRequest._callStack.length;
			var reporter = new WebDriver({
				internConfig: {
					sessionId: 'foo'
				}
			});

			reporter.$others('coverage', {});
			reporter.$others('run', {});
			reporter.$others('foo', {});
			assert.strictEqual(mockRequest._callStack.length, callStackDepth + 1,
				'Only one event should have been dispatched.');
		}
	});
});
