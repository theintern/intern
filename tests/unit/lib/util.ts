import registerSuite = require('intern!object');
import { assert } from 'intern/chai!';
import has = require('dojo/has');
import Promise = require('dojo/Promise');

declare var require: util.AmdRequire;

import _pathUtilType = require('path');
import _hookType = require('istanbul/lib/hook');

if (has('host-node')) {
	/* tslint:disable:no-var-keyword */
	var pathUtil: typeof _pathUtilType = require('path');
	var hook: typeof _hookType = require('istanbul/lib/hook');
	/* tslint:enable:no-var-keyword */
}

import * as util from '../../../lib/util';
import EnvironmentType from '../../../lib/EnvironmentType';

registerSuite({
	name: 'intern/lib/util',

	'.createQueue'() {
		this.skip('TODO');
	},

	'.flattenEnvironments'() {
		const capabilities = { isCapabilities: true };
		const environments = [ {
			browserName: [ 'a', 'b' ],
			version: [ '1', '2' ],
			platform: [ 'c', 'd' ],
			platformVersion: [ '3', '4' ]
		} ];

		const expectedEnvironments = [
			new EnvironmentType({ browserName: 'a', version: '1', platform: 'c', platformVersion: '3', isCapabilities: true }),
			new EnvironmentType({ browserName: 'a', version: '1', platform: 'c', platformVersion: '4', isCapabilities: true }),
			new EnvironmentType({ browserName: 'a', version: '1', platform: 'd', platformVersion: '3', isCapabilities: true }),
			new EnvironmentType({ browserName: 'a', version: '1', platform: 'd', platformVersion: '4', isCapabilities: true }),
			new EnvironmentType({ browserName: 'a', version: '2', platform: 'c', platformVersion: '3', isCapabilities: true }),
			new EnvironmentType({ browserName: 'a', version: '2', platform: 'c', platformVersion: '4', isCapabilities: true }),
			new EnvironmentType({ browserName: 'a', version: '2', platform: 'd', platformVersion: '3', isCapabilities: true }),
			new EnvironmentType({ browserName: 'a', version: '2', platform: 'd', platformVersion: '4', isCapabilities: true }),
			new EnvironmentType({ browserName: 'b', version: '1', platform: 'c', platformVersion: '3', isCapabilities: true }),
			new EnvironmentType({ browserName: 'b', version: '1', platform: 'c', platformVersion: '4', isCapabilities: true }),
			new EnvironmentType({ browserName: 'b', version: '1', platform: 'd', platformVersion: '3', isCapabilities: true }),
			new EnvironmentType({ browserName: 'b', version: '1', platform: 'd', platformVersion: '4', isCapabilities: true }),
			new EnvironmentType({ browserName: 'b', version: '2', platform: 'c', platformVersion: '3', isCapabilities: true }),
			new EnvironmentType({ browserName: 'b', version: '2', platform: 'c', platformVersion: '4', isCapabilities: true }),
			new EnvironmentType({ browserName: 'b', version: '2', platform: 'd', platformVersion: '3', isCapabilities: true }),
			new EnvironmentType({ browserName: 'b', version: '2', platform: 'd', platformVersion: '4', isCapabilities: true })
		];

		assert.deepEqual(util.flattenEnvironments(capabilities, environments), expectedEnvironments,
			'Browser, version, platform, platform version environment properties should be permutated');
	},

	'.getErrorMessage': {
		'basic error logging'() {
			let message: string;

			message = util.getErrorMessage({ name: 'OopsError', message: 'oops2' });
			assert.strictEqual(message, 'OopsError: oops2\nNo stack or location');

			message = util.getErrorMessage({ name: 'OopsError', message: 'oops3', fileName: 'did-it-again.js' });
			assert.strictEqual(message, 'OopsError: oops3\n  at did-it-again.js\nNo stack');

			message = util.getErrorMessage({ name: 'OopsError', message: 'oops4', fileName: 'did-it-again.js',
				lineNumber: '1' });
			assert.strictEqual(message, 'OopsError: oops4\n  at did-it-again.js:1\nNo stack');

			message = util.getErrorMessage({ name: 'OopsError', message: 'oops5', fileName: 'did-it-again.js', lineNumber: '1',
				columnNumber: '0' });
			assert.strictEqual(message, 'OopsError: oops5\n  at did-it-again.js:1:0\nNo stack');
		},

		'stack traces'() {
			let message: string;

			message = util.getErrorMessage({ name: 'OopsError', message: 'oops6',
				stack: 'OopsError: oops6\nat did-it-again.js:1:0' });
			assert.strictEqual(message, 'OopsError: oops6\n  at <did-it-again.js:1:0>');

			message = util.getErrorMessage({ name: 'OopsError', message: 'oops7', stack: 'oops7\nat did-it-again.js:1:0' });
			assert.strictEqual(message, 'OopsError: oops7\n  at <did-it-again.js:1:0>');

			message = util.getErrorMessage({ name: 'OopsError', message: 'oops8', stack: 'at did-it-again.js:1:0' });
			assert.strictEqual(message, 'OopsError: oops8\n  at <did-it-again.js:1:0>');

			message = util.getErrorMessage({ name: 'OopsError', message: 'oops9', stack: '\nat did-it-again.js:1:0' });
			assert.strictEqual(message, 'OopsError: oops9\n  at <did-it-again.js:1:0>');

			message = util.getErrorMessage({ name: 'OopsError', message: undefined, stack: 'OopsError: oops10\nat did-it-again.js:1:0' });
			assert.strictEqual(message, 'OopsError: Unknown error\nOopsError: oops10\n  at <did-it-again.js:1:0>');

			// Chrome/IE stack
			message = util.getErrorMessage({
				name: 'OopsError',
				message: '',
				stack: '    at Foo (http://localhost:8080/test.js:2:8)\n    at http://localhost:8080/test.html:7:5'
			});
			assert.strictEqual(message, 'OopsError: Unknown error\n  at Foo  <test.js:2:8>\n  at <test.html:7:5>');

			// Safari/Firefox stack
			message = util.getErrorMessage({
				name: 'OopsError',
				message: '',
				stack: 'Foo@http://localhost:8080/test.js:2:8\nhttp://localhost:8080/test.html:7:5\nfail'
			});
			assert.strictEqual(message, 'OopsError: Unknown error\n  at Foo  <test.js:2:8>\n  at <test.html:7:5>\nfail');

			message = util.getErrorMessage({ name: '', message: undefined, stack: 'undefined\nat did-it-again.js:1:0' });
			assert.strictEqual(message, 'Error: Unknown error\n  at <did-it-again.js:1:0>');
		},

		'source map from instrumentation'() {
			if (!has('host-node')) {
				this.skip('requires Node.js');
			}

			let wasInstrumented = false;

			const coverageVariable = '__coverage' + Date.now();

			// setup a hook to instrument our test module
			hook.hookRunInThisContext(function () {
				return true;
			}, function (code, file) {
				wasInstrumented = true;
				return util.instrument(code, file, coverageVariable);
			});

			return util.getModule('../data/lib/util/foo', require).then(function (foo: { run(): void; }) {
				assert.ok(wasInstrumented, 'Test module should have been instrumented');

				try {
					foo.run();
				}
				catch (error) {
					let expected = 'util/foo.js:4';
					if (pathUtil && pathUtil.sep !== '/') {
						expected = expected.replace(/\//g, pathUtil.sep);
					}
					assert.include(util.getErrorMessage(error), expected);
				}
			}).finally(function () {
				delete global[coverageVariable];
				hook.unhookRunInThisContext();
			});
		},

		'source map from file'() {
			if (!has('host-node')) {
				this.skip('requires Node.js');
			}

			return util.getModule('../data/lib/util/bar', require).then(function (Bar: { new (): { run(): void; } }) {
				const bar = new Bar();
				try {
					bar.run();
				}
				catch (error) {
					assert.match(util.getErrorMessage(error), /\bbar.ts:5\b/);
				}
			});
		},

		'source map from inline'() {
			if (!has('host-node')) {
				this.skip('requires Node.js');
			}

			return util.getModule('../data/lib/util/baz', require).then(function (Baz: { new (): { run(): void; } }) {
				const baz = new Baz();
				try {
					baz.run();
				}
				catch (error) {
					assert.match(util.getErrorMessage(error), /\bbaz.ts:5\b/);
				}
			});
		},

		'object diff'() {
			const error: util.StackError = {
				name: 'Error',
				message: 'Oops',
				showDiff: true,
				actual: { foo: <any[]> [] },
				expected: {},
				stack: ''
			};

			assert.include(
				util.getErrorMessage(error),
				'Error: Oops\n\nE {}\nA {\nA   "foo": [\nA     length: 0\nA   ]\nA }\n\n',
				'Object diff should be included in message'
			);

			error.actual = {};
			error.expected = {};

			assert.include(
				util.getErrorMessage(error),
				'Error: Oops\nNo stack',
				'No diff should exist for identical objects'
			);

			error.actual = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ];
			error.expected = [ 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 32 ];

			assert.include(
				util.getErrorMessage(error),
				'Error: Oops\n\n  [\nE   0: 0,\nA   0: 1,\n    1: 2,\n    2: 3,\n    3: 4,\n    4: 5,\n[...]\n' +
				'    11: 12,\n    12: 13,\n    13: 14,\n    14: 15,\nE   15: 32,\nA   15: 16,\n    length: 16\n  ]\n\n',
				'Splits in long diffs should be indicated by an ellipsis'
			);
		}
	},

	'.retry': {
		'until failure'() {
			let numAttempts = 0;
			const expected = new Error('Oops');

			return util.retry(function () {
				++numAttempts;
				return Promise.reject(expected);
			}, 3).then(function () {
				assert.ok(false, 'Retry should reject after the final attempt ends in failure');
			}, function (error) {
				assert.strictEqual(error, expected, 'Retry should reject with the error from the callback');
				assert.strictEqual(numAttempts, 4, 'Retry should retry numRetries times after the first failure');
			});
		},
		'until success'() {
			let numAttempts = 0;
			const expected = new Error('Oops');

			return util.retry(function () {
				if (++numAttempts < 2) {
					return Promise.reject(expected);
				}

				return Promise.resolve('ok');
			}, 3).then(function (result) {
				assert.strictEqual(result, 'ok', 'Retry should pass the resolved value');
				assert.strictEqual(numAttempts, 2, 'Retry should stop retrying once the callback resolves');
			});
		}
	},

	'.serialize'() {
		{
			const object = {
				a: {
					b: {
						c: {}
					}
				}
			};

			assert.strictEqual(
				util.serialize(object),
				'{\n  "a": {\n    "b": {\n      "c": {}\n    }\n  }\n}',
				'Object properties should be correctly indented'
			);
		}

		{
			const object: { [index: number]: string; foo?: string; } = [ 'zero' ];
			object.foo = 'foo';

			assert.strictEqual(
				util.serialize(object),
				'[\n  0: "zero",\n  "foo": "foo",\n  length: 1\n]',
				'Arrays should be displayed with square brackets, non-numeric keys, and length'
			);
		}

		{
			const object: { [index: number]: number; } & { $foo?: string; } = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ];
			object.$foo = '$foo';

			assert.strictEqual(
				util.serialize(object),
				'[\n  0: 1,\n  1: 2,\n  2: 3,\n  3: 4,\n  4: 5,\n  5: 6,\n  6: 7,\n  7: 8,\n  8: 9,\n  9: 10,\n' +
				'  10: 11,\n  11: 12,\n  12: 13,\n  13: 14,\n  14: 15,\n  15: 16,\n  "$foo": "$foo",\n  length: 16\n]',
				'Numeric keys should be sorted in natural order and placed before properties'
			);
		}

		{
			let object: ((() => void) & { foo?: string; }) = function fn() {};
			object.foo = 'foo';

			if (has('function-name')) {
				assert.strictEqual(
					util.serialize(object),
					'fn({\n  "foo": "foo"\n})',
					'Functions should be displayed with the function name and static properties'
				);

				object = function () {};

				assert.strictEqual(
					util.serialize(object),
					'<anonymous>({})',
					'Functions without names should be given an anonymous name'
				);
			}
			else {
				assert.strictEqual(
					util.serialize(object),
					'<function>({\n  "foo": "foo"\n})',
					'Functions should be displayed as a function with static properties'
				);
			}
		}

		{
			const object = { s: 'string', n: 1.23, b: true, o: <any> null, u: <any> undefined, r: /foo/im, d: new Date(0) };
			assert.strictEqual(
				util.serialize(object),
				'{\n  "b": true,\n  "d": 1970-01-01T00:00:00.000Z,\n  "n": 1.23,\n  "o": null,\n  "r": /foo/im,' +
				'\n  "s": "string",\n  "u": undefined\n}',
				'All primitive JavaScript types should be represented accurately in the output'
			);
		}
	}
});
