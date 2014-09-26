define([
	'intern!object',
	'intern/chai!assert',
	'../../../../../lib/reporters/pretty/StatusBar',
	'../../../../../lib/reporters/pretty/Results'
], function (registerSuite, assert, StatusBar, Results) {
	registerSuite(function () {
		var mockCharm, statusBar, results;

		return {
			name: 'intern/lib/reporters/pretty/StatusBar',

			'beforeEach': function () {
				var writeMock = function () {
					writeMock.data.push(arguments);
					writeMock.str += arguments[0];
					return mockCharm;
				};
				writeMock.data = [];
				writeMock.str = '';

				function passthru() {
					return mockCharm;
				}

				mockCharm = {
					write: writeMock,
					display: passthru,
					foreground: passthru
				};

				results = new Results(10, 10);
				statusBar = new StatusBar(mockCharm, results);
			},

			'construction': function () {
				assert.strictEqual(statusBar.charm, mockCharm);
			},

			'.render': {
				'pending': function () {
					statusBar.render();
					assert.strictEqual(mockCharm.write.str, '/         ');
				},

				'pass': function () {
					results.recordPassed();
					statusBar.render();
					assert.strictEqual(mockCharm.write.str, '\u2714/        ');
				},

				'fail': function () {
					results.recordFailed();
					statusBar.render();
					assert.strictEqual(mockCharm.write.str, 'x/        ');
				},

				'skip': function () {
					results.recordSkipped();
					statusBar.render();
					assert.strictEqual(mockCharm.write.str, '~/        ');
				},

				'spinner': function () {
					statusBar.render();
					assert.strictEqual(mockCharm.write.str, '/         ');
					mockCharm.write.str = '';

					statusBar.render();
					assert.strictEqual(mockCharm.write.str, '-         ');
					mockCharm.write.str = '';

					statusBar.render();
					assert.strictEqual(mockCharm.write.str, '\\         ');
					mockCharm.write.str = '';

					statusBar.render();
					assert.strictEqual(mockCharm.write.str, '|         ');
					mockCharm.write.str = '';

					statusBar.render();
					assert.strictEqual(mockCharm.write.str, '/         ');
				},

				'complete': function () {
					results.recordPassed();
					results.recordPassed();
					results.recordFailed();
					results.recordPassed();
					results.recordPassed();
					results.recordSkipped();
					results.recordPassed();
					results.recordPassed();
					results.recordFailed();
					results.recordPassed();

					statusBar.render();
					assert.strictEqual(mockCharm.write.str, '\u2714\u2714x\u2714\u2714~\u2714\u2714x\u2714');
				}
			}
		};
	});
});