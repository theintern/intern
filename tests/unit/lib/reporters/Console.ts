import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import MockConsole from './support/MockConsole';
import { Suite } from '../../../../src/lib/Suite';
import { Test } from '../../../../src/lib/Test';
import { Console } from '../../../../src/lib/reporters/Console';
import * as pathUtil from 'dojo/has!host-node?dojo/node!path';
import has = require('dojo/has');

registerSuite({
	name: 'intern/lib/reporters/Console',

	suiteStart() {
		const mockConsole = new MockConsole(true);
		const reporter = new Console({ console: mockConsole });

		const suite = new Suite(<any> { name: 'suite', parent: {} });

		reporter.suiteStart(suite);
		assert.lengthOf(mockConsole.messages['group'], 1,
			'console.group should be called when the reporter suiteStart method is called');
		assert.strictEqual(mockConsole.messages['group'][0], suite.name,
			'console.group should be called with the name of the suite');
	},

	suiteEnd: {
		'successful suite'() {
			const mockConsole = new MockConsole();
			const reporter = new Console({ console: mockConsole });
			const suite = new Suite({ name: 'suite', tests: [ new Test(<any> { hasPassed: true }) ] });

			reporter.suiteEnd(suite);
			assert.lengthOf(mockConsole.messages['info'], 1,
				'console.info should be called when the reporter suiteEnd method is ' +
				'called and there are no errors');
			assert.match(mockConsole.messages['info'][0],
				new RegExp('^' + suite.numFailedTests + '/' + suite.numTests + ' '),
				'console.info message should say how many tests failed and how many total tests existed');
		},

		'failed suite'() {
			const mockConsole = new MockConsole();
			const reporter = new Console({ console: mockConsole });
			const suite = new Suite({ name: 'suite', tests: [ new Test(<any> { hasPassed: false }) ] });

			reporter.suiteEnd(suite);
			assert.lengthOf(mockConsole.messages['warn'], 1,
				'console.warn should be called when the reporter SuiteEnd method is ' +
				'called and there are errors');
			assert.match(mockConsole.messages['warn'][0],
				new RegExp('^' + suite.numFailedTests + '/' + suite.numTests + ' '),
				'console.warn message should say how many tests passed and how many total tests existed');
		},

		grouping() {
			const mockConsole = new MockConsole(true);
			const reporter = new Console({ console: mockConsole });
			const suite = new Suite({ name: 'suite' });

			reporter.suiteEnd(suite);
			assert.lengthOf(mockConsole.messages['groupEnd'], 1,
				'console.groupEnd should be called when the reporter suiteEnd method is called');
			assert.strictEqual(mockConsole.messages['groupEnd'][0], suite.name,
				'console.groupEnd should be called with the name of the suite');
		}
	},

	fatalError() {
		const mockConsole = new MockConsole();
		const reporter = new Console({ console: mockConsole });
		const error = new Error('Oops');

		reporter.fatalError(error);

		assert.lengthOf(mockConsole.messages['warn'], 1,
			'console.warn should be called once for a fatal error');
		assert.lengthOf(mockConsole.messages['error'], 1,
			'console.error should be called once for a fatal error');

		const result = mockConsole.messages['warn'][0] + '\n' + mockConsole.messages['error'][0];
		assert.match(result, /\bFATAL ERROR\b/, 'Reporter should indicate that a fatal error occurred');
		assert.include(result, 'Oops', 'Reporter should include the message from the error');
		if (result.indexOf('No stack or location') === -1) {
			// the line number in the message should be the same as the line where the new Error
			// was created above
			let expected = has('host-node') ? 'tests/unit/lib/reporters/Console.ts:71' : 'tests/unit/lib/reporters/Console.js';
			if (pathUtil && pathUtil.sep !== '/') {
				expected = expected.replace(/\//g, pathUtil.sep);
			}
			assert.include(result, expected,
				'Reporter should indicate the location of the error');
		}
	},

	testPass() {
		const mockConsole = new MockConsole();
		const reporter = new Console({ console: mockConsole });
		const test = new Test(<any> {
			name: 'test',
			timeElapsed: 123,
			parent: { name: 'parent', id: 'parent' },
			hasPassed: true
		});

		reporter.testPass(test);
		assert.lengthOf(mockConsole.messages['log'], 1, 'console.log should ahve been called once for testPass');

		const message = mockConsole.messages['log'][0];
		assert.match(message, /\bPASS\b/, 'Reporter should indicate that a test passed');
		assert.include(message, test.id, 'Reporter should indicate which test passed');
		assert.include(message, test.timeElapsed + 'ms',
			'Reporter should indicate the amount of time the test took');
	},

	testFail() {
		const mockConsole = new MockConsole();
		const reporter = new Console({ console: mockConsole });
		const test = new Test(<any> {
			name: 'test',
			timeElapsed: 123,
			parent: { name: 'parent', id: 'parent' },
			error: new Error('Oops')
		});

		reporter.testFail(test);
		assert.lengthOf(mockConsole.messages['error'], 2, 'console.error should be called twice for a failed test');

		const result = mockConsole.messages['error'].join('\n');
		assert.match(result, /\bFAIL\b/, 'Reporter should indicate that a test failed');
		assert.include(result, test.id, 'Reporter should indicate which test failed');
		assert.include(result, test.timeElapsed + 'ms',
			'Reporter should indicate the amount of time the test took');
	}
});
