import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import { ReporterManager } from '../../../src/lib/ReporterManager';
import { JUnit } from '../../../src/lib/reporters/JUnit';
import Promise = require('dojo/Promise');
import has = require('dojo/has');
import * as fs from 'dojo/has!host-node?dojo/node!fs';
import * as pathUtil from 'dojo/has!host-node?dojo/node!path';

registerSuite({
	name: 'intern/lib/ReporterManager',

	'add/remove legacy reporter'() {
		const actual: string[] = [];
		const expected: string[] = [];
		const reporterManager = new ReporterManager();

		// legacy reporter
		const handle = reporterManager.add({
			'/some/topic': function () {
				actual.push('topic1');
			},
			stop: function () {
				actual.push('stopped');
			}
		});

		reporterManager.emit('someTopic');
		expected.push('topic1');
		assert.deepEqual(actual, expected, 'Reporter should respond to topics automatically when added');

		handle.remove();
		expected.push('stopped');
		assert.deepEqual(actual, expected, 'Reporter should be stopped when it is removed');

		reporterManager.emit('someTopic');
		assert.deepEqual(actual, expected, 'Reporter should not respond to topics once it has been removed');

		assert.doesNotThrow(function () {
			handle.remove();
		}, Error, 'Removing an removed reporter should not throw');
	},

	'add/remove Reporter'() {
		function MockReporter(config: { option?: any }): void {
			actual.push(config.option);
		}

		MockReporter.prototype = {
			someTopic: function () {
				actual.push('topic1');
			},
			destroy: function () {
				actual.push('stopped');
			}
		};

		const actual: string[] = [];
		const expected: string[] = [];
		const reporterManager = new ReporterManager();
		let handle: any;

		expected.push('created');
		handle = reporterManager.add(MockReporter, <any> { option: 'created' });
		assert.deepEqual(actual, expected, 'Reporter instance should have been instantiated with config arguments');

		reporterManager.emit('someTopic');
		expected.push('topic1');
		assert.deepEqual(actual, expected, 'Reporter should respond to topics automatically when added');

		handle.remove();
		expected.push('stopped');
		assert.deepEqual(actual, expected, 'Reporter should be stopped when it is removed');

		reporterManager.emit('someTopic');
		assert.deepEqual(actual, expected, 'Reporter should not respond to topics after removal');

		assert.doesNotThrow(function () {
			handle.remove();
		}, Error, 'Removing an removed reporter should not throw');
	},

	'add Reporter with output file'(this: any) {
		function unlink(pathname: string) {
			if (!pathname || pathname === '.') {
				return;
			}

			try {
				if (fs.statSync(pathname).isDirectory()) {
					fs.rmdirSync(pathname);
				}
				else {
					fs.unlinkSync(pathname);
				}
			}
			catch (error) { /* ignored */ }

			unlink(pathUtil.dirname(pathname));
		}

		if (!has('host-node')) {
			this.skip();
		}

		const simpleName = 'test.result';
		const dirName = 'report/dir/test.result';
		const reporterManager = new ReporterManager();
		reporterManager.add(JUnit, { filename: simpleName });
		reporterManager.add(JUnit, { filename: dirName });

		try {
			assert.isTrue(fs.statSync(simpleName).isFile(), 'Report file should exist');
			assert.isTrue(fs.statSync(dirName).isFile(), 'Report directory and file should exist');
		}
		finally {
			unlink(simpleName);
			unlink(dirName);
		}
	},

	'reporterError'() {
		const reporterManager = new ReporterManager();

		const firstError = new Error('Oops');
		const secondError = new Error('Oops again!');
		let reporter: any;
		let actual: any;

		class MockReporter {
			constructor() {
				reporter = this;
			}
			runStart() {
				throw firstError;
			}
			runEnd() {
				return Promise.reject(secondError);
			}
			reporterError() {
				actual = Array.prototype.slice.call(arguments, 0);
				throw new Error('Throwing this error should not cause reporterError to be called again');
			}
		}

		reporterManager.add(MockReporter, {});

		return reporterManager.emit('runStart').then(function () {
			assert.deepEqual(actual, [ reporter, firstError ]);
			return reporterManager.emit('runEnd');
		}).then(function () {
			assert.deepEqual(actual, [ reporter, secondError ]);
		});
	}
});
