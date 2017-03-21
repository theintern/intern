define([
	'intern!object',
	'intern/chai!assert',
	'../../../lib/ReporterManager',
	'../../../lib/reporters/JUnit',
	'dojo/Promise',
	'dojo/has',
	'dojo/has!host-node?dojo/node!fs',
	'dojo/has!host-node?dojo/node!path'
], function (registerSuite, assert, ReporterManager, JUnit, Promise, has, fs, pathUtil) {
	registerSuite({
		name: 'intern/lib/ReporterManager',

		'add/remove legacy reporter': function () {
			var actual = [];
			var expected = [];
			var reporterManager = new ReporterManager();

			// legacy reporter
			var handle = reporterManager.add({
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

		'add/remove Reporter': function () {
			function MockReporter(config) {
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

			var actual = [];
			var expected = [];
			var reporterManager = new ReporterManager();
			var handle;

			expected.push('created');
			handle = reporterManager.add(MockReporter, { option: 'created' });
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

		'add Reporter with output file': function () {
			function unlink(pathname) {
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

			var simpleName = 'test.result';
			var dirName = pathUtil.join('report', 'dir', 'test.result');
			var reporterManager = new ReporterManager();
			reporterManager.add(JUnit, { filename: simpleName });
			reporterManager.add(JUnit, { filename: dirName });

			return new Promise(function (resolve, reject) {
				// At least Windows 7 experiences race conditions when sync file functions are used on a created write
				// stream. Make the first stat async to avoid this.
				fs.stat(simpleName, function (error, stats) {
					if (error) {
						reject(error);
					}
					else {
						try {
							assert.isTrue(stats.isFile(), 'Report file should exist');
							assert.isTrue(fs.statSync(dirName).isFile(), 'Report directory and file should exist');
							resolve();
						}
						catch (error) {
							reject(error);
						}
					}
				});
			}).finally(function () {
				unlink(simpleName);
			}).finally(function () {
				unlink(dirName);
			});
		},

		'reporterError': function () {
			var reporterManager = new ReporterManager();

			var firstError = new Error('Oops');
			var secondError = new Error('Oops again!');
			var reporter;
			var actual;

			function MockReporter() {
				reporter = this;
			}
			MockReporter.prototype.runStart = function () {
				throw firstError;
			};
			MockReporter.prototype.runEnd = function () {
				return Promise.reject(secondError);
			};
			MockReporter.prototype.reporterError = function () {
				actual = Array.prototype.slice.call(arguments, 0);
				throw new Error('Throwing this error should not cause reporterError to be called again');
			};

			reporterManager.add(MockReporter, {});

			return reporterManager.emit('runStart').then(function () {
				assert.deepEqual(actual, [ reporter, firstError ]);
				return reporterManager.emit('runEnd');
			}).then(function () {
				assert.deepEqual(actual, [ reporter, secondError ]);
			});
		}
	});
});
