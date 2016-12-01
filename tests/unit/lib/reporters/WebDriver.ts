import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import { default as Suite, SuiteConfig } from '../../../../src/lib/Suite';
import { default as Test, TestConfig } from '../../../../src/lib/Test';
import WebDriver from '../../../../src/lib/reporters/WebDriver';

let reporter: WebDriver;
let messages: { name: string, args: IArguments | any[] }[];
let documentAdded = false;

function messageTest(name: string, object?: any) {
	let reporterObject = <any> reporter;
	if (reporterObject[name]) {
		reporterObject[name](object);
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

function createSuiteMessageTest(name: string) {
	return function () {
		const suite = new Suite(<SuiteConfig> { name: 'suite', parent: <Suite> {} });
		return messageTest(name, suite);
	};
}

function createTestMessageTest(name: string) {
	return function () {
		const test = new Test(<TestConfig> { name: 'test', parent: <Suite> {} });
		return messageTest(name, test);
	};
}

function createMessageTest(name: string) {
	return function () {
		return messageTest(name);
	};
}

registerSuite({
	name: 'intern/lib/reporters/WebDriver',

	setup() {
		if (typeof document === 'undefined') {
			/* globals global */
			(<any> global).document = {};
			documentAdded = true;
		}
	},

	beforeEach() {
		reporter = new WebDriver({
			writeHtml: false,
			internConfig: {
				sessionId: 'foo'
			}
		});
		messages = [];

		reporter['_sendEvent'] = function (name, args) {
			messages.push({
				name: name,
				args: args
			});
		};

		reporter['_scroll'] = function () {};
	},

	afterEach() {
		messages = null;
		reporter = null;
	},

	teardown() {
		if (documentAdded) {
			delete (<any> global).document;
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
