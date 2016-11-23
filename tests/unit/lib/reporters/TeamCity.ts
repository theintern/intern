import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import MockStream from './support/MockStream';
import { Suite } from '../../../../src/lib/Suite';
import { Test } from '../../../../src/lib/Test';
import { TeamCity } from '../../../../src/lib/reporters/TeamCity';
import * as util from '../../../../src/lib/util';

const messagePatterns: any = {
	suiteStart: '^##teamcity\\[testSuiteStarted name=\'{id}\'',
	suiteEnd: '^##teamcity\\[testSuiteFinished name=\'{id}\' duration=\'\\d+\'',
	testStart: '^##teamcity\\[testStarted name=\'{id}\'',
	testSkip: '^##teamcity\\[testIgnored name=\'{id}\'',
	testEnd: '^##teamcity\\[testFinished name=\'{id}\' duration=\'\\d+\'',
	testFail: '^##teamcity\\[testFailed name=\'{id}\' message=\'{message}\''
};

function testSuite(suite: Suite, topic: string, type: string) {
	const output = new MockStream();
	const reporter: any = new TeamCity({ output: output });
	const expected = messagePatterns[topic].replace('{id}', suite.id);

	reporter[topic](suite);
	assert.ok(output.data, 'Data should be output when the reporter ' + topic + ' method is called');
	assert.match(
		output.data,
		new RegExp(expected),
		'Output data for ' + type + ' message should match expected message pattern');
}

function testTest(test: Test, topic: string, type: string) {
	const output = new MockStream();
	const reporter: any = new TeamCity({ output: output });
	let expected = messagePatterns[topic].replace('{id}', test.id);

	if (test.error) {
		// n.b., only the `testFail` messagePattern has a `{message}` placeholder
		const errorMessage = reporter._escapeString(util.getErrorMessage(test.error));
		expected = expected.replace('{message}', errorMessage);
	}

	reporter[topic](test);
	assert.ok(output.data, 'Data should be output when the reporter ' + topic + ' method is called');
	assert.match(
		output.data,
		new RegExp(expected),
		'Output data for ' + type + ' should match expected message pattern');
}

registerSuite({
	name: 'intern/lib/reporters/TeamCity',

	suiteStart: function () {
		const suite = new Suite(<any> { name: 'suite', parent: true });
		testSuite(suite, 'suiteStart', 'testSuiteStarted');
	},

	suiteEnd: {
		'successful suite': function () {
			const suite = new Suite(<any> { name: 'suite', parent: true, timeElapsed: 123, tests: [ new Test(<any> { hasPassed: true }) ] });
			testSuite(suite, 'suiteEnd', 'testSuiteFinished');
		},

		'failed suite': function () {
			const suite = new Suite(<any> { name: 'suite', parent: true, timeElapsed: 123, tests: [ new Test(<any> { hasPassed: false }) ] });
			testSuite(suite, 'suiteEnd', 'testSuiteFinished');
		}
	},

	testStart: function () {
		const test = new Test(<any> {
			name: 'test',
			timeElapsed: 123,
			parent: { name: 'parent', id: 'parent' },
			error: new Error('Oops')
		});
		testTest(test, 'testStart', 'testStarted');
	},

	testSkip: function () {
		const test = new Test(<any> {
			name: 'test',
			timeElapsed: 123,
			parent: { name: 'parent', id: 'parent' },
			error: new Error('Oops')
		});
		testTest(test, 'testSkip', 'testIgnored');
	},

	testEnd: function () {
		const test = new Test(<any> {
			name: 'test',
			timeElapsed: 123,
			parent: { name: 'parent', id: 'parent' },
			error: new Error('Oops')
		});
		testTest(test, 'testEnd', 'testFinished');
	},

	testFail: function () {
		const test = new Test(<any> {
			name: 'test',
			timeElapsed: 123,
			parent: { name: 'parent', id: 'parent' },
			error: new Error('Oops')
		});
		testTest(test, 'testFail', 'testFailed');
	}
});
