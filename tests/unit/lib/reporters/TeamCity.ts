import registerSuite = require('intern!object');
import { assert } from 'intern/chai!';
import MockStream from './support/MockStream';
import Suite from './support/MockableSuite';
import Test from './support/MockableTest';
import TeamCity from '../../../../lib/reporters/TeamCity';

const messagePatterns = <{ [ topic: string]: string; }> {
	suiteStart: '^##teamcity\\[testSuiteStarted name=\'{id}\'',
	suiteEnd: '^##teamcity\\[testSuiteFinished name=\'{id}\' duration=\'\\d+\'',
	testStart: '^##teamcity\\[testStarted name=\'{id}\'',
	testSkip: '^##teamcity\\[testIgnored name=\'{id}\'',
	testEnd: '^##teamcity\\[testFinished name=\'{id}\' duration=\'\\d+\'',
	testFail: '^##teamcity\\[testFailed name=\'{id}\' message=\'{message}\''
};

function testSuite(suite: Suite, topic: string, type: string) {
	const output = new MockStream();
	const reporter = new TeamCity({ output: output });
	const expected = messagePatterns[topic].replace('{id}', suite.id);

	(<any> reporter)[topic](suite);
	assert.ok(output.data, 'Data should be output when the reporter ' + topic + ' method is called');
	assert.match(
		output.data,
		new RegExp(expected),
		'Output data for ' + type + ' message should match expected message pattern');
}

function testTest(test: Test, topic: string, type: string) {
	const output = new MockStream();
	const reporter = new TeamCity({ output: output });
	let expected = messagePatterns[topic].replace('{id}', test.id);

	if (test.error) {
		expected = expected.replace('{message}', test.error.message);
	}

	(<any> reporter)[topic](test);
	assert.ok(output.data, 'Data should be output when the reporter ' + topic + ' method is called');
	assert.match(
		output.data,
		new RegExp(expected),
		'Output data for ' + type + ' should match expected message pattern');
}

registerSuite({
	name: 'intern/lib/reporters/TeamCity',

	suiteStart() {
		const suite = new Suite({ name: 'suite', parent: new Suite({ name: '' }) });
		testSuite(suite, 'suiteStart', 'testSuiteStarted');
	},

	suiteEnd: {
		'successful suite'() {
			const suite = new Suite({ name: 'suite', parent: new Suite({ name: 'parent' }), timeElapsed: 123, tests: [ new Test({ hasPassed: true }) ] });
			testSuite(suite, 'suiteEnd', 'testSuiteFinished');
		},

		'failed suite'() {
			const suite = new Suite({ name: 'suite', parent: new Suite({ name: 'parent' }), timeElapsed: 123, tests: [ new Test({ hasPassed: false }) ] });
			testSuite(suite, 'suiteEnd', 'testSuiteFinished');
		}
	},

	testStart() {
		const test = new Test({
			name: 'test',
			timeElapsed: 123,
			parent: new Suite({ name: 'parent' }),
			error: new Error('Oops')
		});
		testTest(test, 'testStart', 'testStarted');
	},

	testSkip() {
		const test = new Test({
			name: 'test',
			timeElapsed: 123,
			parent: new Suite({ name: 'parent' }),
			error: new Error('Oops')
		});
		testTest(test, 'testSkip', 'testIgnored');
	},

	testEnd() {
		const test = new Test({
			name: 'test',
			timeElapsed: 123,
			parent: new Suite({ name: 'parent' }),
			error: new Error('Oops')
		});
		testTest(test, 'testEnd', 'testFinished');
	},

	testFail() {
		const test = new Test({
			name: 'test',
			timeElapsed: 123,
			parent: new Suite({ name: 'parent' }),
			error: new Error('Oops')
		});
		testTest(test, 'testFail', 'testFailed');
	}
});
