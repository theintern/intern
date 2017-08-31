import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import * as cli from '../../src/lib/cli';
import * as fs from 'fs';
import * as path from 'path';

registerSuite({
	name: 'lib/cli',

	acceptVersion() {
		assert.isTrue(cli.acceptVersion('3.3.0-pre', '3.0.0'));
		assert.isTrue(cli.acceptVersion('3.3.2', '3.0.0'));
		assert.isFalse(cli.acceptVersion('2.3.2', '3.0.0'));
	},

	collect() {
		const input: string[] = [];
		cli.collect('5', input);
		assert.deepEqual(input, [ '5' ]);

		cli.collect('6', input);
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
				cli.copy('./tests/unit/all.ts', path.join(tempdir, 'all.js'));
				assert.isTrue(fs.statSync(path.join(tempdir, 'all.js')).isFile());
			},

			'copy dir'() {
				cli.copy('./tests', tempdir);
				assert.isTrue(fs.statSync(path.join(tempdir, 'unit', 'all.ts')).isFile());
			}
		};
	})(),

	enumArg: (function () {
		const oldDie = cli.die;
		let message: string | null;

		return {
			setup() {
				cli._setDieMethod(function (msg: string) {
					message = msg;
				});
			},

			beforeEach() {
				message = null;
			},

			teardown() {
				cli._setDieMethod(oldDie);
			},

			good() {
				assert.strictEqual(cli.enumArg([ 'a', 'b' ], 'a'), 'a');
				assert.isNull(message);
			},

			bad() {
				cli.enumArg([ 'a', 'b' ], 'c');
				assert.isNotNull(message);
			}
		};
	})()
});
