define([
	'require',
	'intern!object',
	'intern/chai!assert',
	'intern/dojo/node!../../lib/cli',
	'intern/dojo/node!fs',
	'intern/dojo/node!path'
], function (
	require,
	registerSuite,
	assert,
	cli,
	fs,
	path
) {
	registerSuite({
		name: 'lib/cli',

		acceptVersion: function () {
			assert.isTrue(cli.acceptVersion('3.3.0-pre', '3.0.0'));
			assert.isTrue(cli.acceptVersion('3.3.2', '3.0.0'));
			assert.isFalse(cli.acceptVersion('2.3.2', '3.0.0'));
		},

		collect: function () {
			var input = [];
			cli.collect('5', input);
			assert.deepEqual(input, [ '5' ]);

			cli.collect('6', input);
			assert.deepEqual(input, [ '5', '6' ]);
		},

		copy: (function () {
			function rm(name) {
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

			var tempdir;

			return {
				setup: function () {
					fs.mkdirSync('.testtmp');
					tempdir = '.testtmp';
				},

				afterEach: function () {
					fs.readdirSync(tempdir).forEach(function (filename) {
						rm(path.join(tempdir, filename));
					});
				},

				teardown: function () {
					rm(tempdir);
				},

				'copy file': function () {
					cli.copy('./tests/unit/all.js', path.join(tempdir, 'all.js'));
					assert.isTrue(fs.statSync(path.join(tempdir, 'all.js')).isFile());
				},

				'copy dir': function () {
					cli.copy('./tests', tempdir);
					assert.isTrue(fs.statSync(path.join(tempdir, 'unit', 'all.js')).isFile());
				}
			};
		})(),

		enumArg: (function () {
			var oldDie = cli.die;
			var message;

			return {
				setup: function () {
					cli.die = function (msg) {
						message = msg;
					};
				},

				beforeEach: function () {
					message = null;
				},

				teardown: function () {
					cli.die = oldDie;
				},

				good: function () {
					assert.strictEqual(cli.enumArg([ 'a', 'b' ], 'a'), 'a');
					assert.isNull(message);
				},

				bad: function () {
					cli.enumArg([ 'a', 'b' ], 'c');
					assert.isNotNull(message);
				}
			};
		})()
	});
});
