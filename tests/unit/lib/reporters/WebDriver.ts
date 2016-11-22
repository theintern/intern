define([
	'intern!object',
	'intern/chai!assert',
	'../../../../lib/Suite',
	'../../../../lib/Test',
	'../../../../lib/reporters/WebDriver'
], function (
	registerSuite,
	assert,
	Suite,
	Test,
	WebDriver
) {
	var reporter;
	var messages;
	var documentAdded = false;

	function messageTest(name, object) {
		if (reporter[name]) {
			reporter[name](object);
		}
		else {
			reporter.$others(name, object);
		}
		assert.lengthOf(messages, 1, 'expected a message to be sent');
		assert.strictEqual(messages[0].name, name, 'unexpected message name ' + messages[0].name);
		if (object) {
			assert.strictEqual(messages[0].args[0], object, 'unexpected message args');
		}
	}

	function createSuiteMessageTest(name) {
		return function () {
			var suite = new Suite({ name: 'suite', parent: {} });
			return messageTest(name, suite);
		};
	}

	function createTestMessageTest(name) {
		return function () {
			var test = new Test({ name: 'test', parent: {} });
			return messageTest(name, test);
		};
	}

	function createMessageTest(name) {
		return function () {
			return messageTest(name);
		};
	}

	registerSuite({
		name: 'intern/lib/reporters/WebDriver',

		setup: function () {
			if (typeof document === 'undefined') {
				/* globals global */
				global.document = {};
				documentAdded = true;
			}
		},

		beforeEach: function () {
			reporter = new WebDriver({
				writeHtml: false,
				internConfig: {
					sessionId: 'foo'
				}
			});
			messages = [];

			reporter._sendEvent = function (name, args) {
				messages.push({
					name: name,
					args: args
				});
			};

			reporter._scroll = function () {};
		},

		afterEach: function () {
			messages = null;
			reporter = null;
		},

		teardown: function () {
			if (documentAdded) {
				delete global.document;
			}
		},

		suiteStart: createSuiteMessageTest('suiteStart'),
		suiteEnd: createSuiteMessageTest('suiteEnd'),
		suiteError: createSuiteMessageTest('suiteError'),

		runStart: createMessageTest('runStart'),
		runEnd: createMessageTest('runEnd'),

		testStart: createTestMessageTest('testStart'),
		testPass: createTestMessageTest('testPass'),
		testSkip: createTestMessageTest('testSkip'),
		testEnd: createTestMessageTest('testEnd'),
		testFail: createTestMessageTest('testFail')
	});
});

