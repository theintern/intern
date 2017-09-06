import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import * as util from 'src/lib/util';
import * as fs from 'fs';
import * as path from 'path';

registerSuite({
	name: 'lib/util',

	acceptVersion() {
		assert.isTrue(util.acceptVersion('3.3.0-pre', '3.0.0'));
		assert.isTrue(util.acceptVersion('3.3.2', '3.0.0'));
		assert.isFalse(util.acceptVersion('2.3.2', '3.0.0'));
	},

	collect() {
		const input: string[] = [];
		util.collect('5', input);
		assert.deepEqual(input, [ '5' ]);

		util.collect('6', input);
		assert.deepEqual(input, [ '5', '6' ]);
	},

	copy: (function () {
		function rm(name: string) {
			if (fs.statSync(name).isDirectory()) {
				fs.readdirSync(name).forEach(function (filename) {
					rm(path.join(name, filename));
				});
				fs.rmdirSync(name);
			}
			else {
				fs.unlinkSync(name);
			}
		}

		let tempdir: string;

		return {
			setup() {
				fs.mkdirSync('.testtmp');
				tempdir = '.testtmp';
			},

			afterEach() {
				fs.readdirSync(tempdir).forEach(function (filename: string) {
					rm(path.join(tempdir, filename));
				});
			},

			teardown() {
				rm(tempdir);
			},

			'copy file'() {
				util.copy('./tests/unit/all.ts', path.join(tempdir, 'all.js'));
				assert.isTrue(fs.statSync(path.join(tempdir, 'all.js')).isFile());
			},

			'copy dir'() {
				util.copy('./tests', tempdir);
				assert.isTrue(fs.statSync(path.join(tempdir, 'unit', 'all.ts')).isFile());
			}
		};
	})(),

	enumArg: (function () {
		const oldDie = util.die;
		let message: string | null;

		return {
			setup() {
				util._setDieMethod(function (msg: string) {
					message = msg;
				});
			},

			beforeEach() {
				message = null;
			},

			teardown() {
				util._setDieMethod(oldDie);
			},

			good() {
				assert.strictEqual(util.enumArg([ 'a', 'b' ], 'a'), 'a');
				assert.isNull(message);
			},

			bad() {
				util.enumArg([ 'a', 'b' ], 'c');
				assert.isNotNull(message);
			}
		};
	})()
});
