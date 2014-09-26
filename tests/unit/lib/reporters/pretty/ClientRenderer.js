define([
	'intern!object',
	'intern/chai!assert',
	'../../../../../lib/reporters/pretty/ClientRenderer'
], function (registerSuite, assert, ClientRenderer) {
	registerSuite(function () {
		var mockCharm, renderer;

		return {
			name: 'intern/lib/reporters/pretty/ClientRenderer',

			'beforeEach': function () {
				var writeMock = function () {
					writeMock.data.push(arguments);
					writeMock.str += arguments[0];
					return mockCharm;
				};
				writeMock.data = [];
				writeMock.str = '';

				mockCharm = {
					write: writeMock,
					display: function () {
						return mockCharm;
					},
					foreground: function () {
						return mockCharm;
					}
				};

				renderer = new ClientRenderer(mockCharm, 10);
			},

			'construction': function () {
				assert.isTrue(renderer.needsRender);
			},

			'.height': function () {
				assert.strictEqual(renderer.height, 2);
			},

			'.needsRender': {
				'true when dirty': function () {
					renderer._dirty = true;
					assert.isTrue(renderer.needsRender);
				},

				'false when not dirty': function () {
					renderer._dirty = false;
					assert.isFalse(renderer.needsRender);
				}
			},

			'.recordPassed': function () {
				renderer._dirty = false;
				renderer.recordPassed();
				assert.isTrue(renderer.needsRender);
			},

			'.recordFailed': function () {
				renderer._dirty = false;
				renderer.recordFailed();
				assert.isTrue(renderer.needsRender);
			},

			'.recordSkipped': function () {
				renderer._dirty = false;
				renderer.recordSkipped();
				assert.isTrue(renderer.needsRender);
			},

			'.render': function () {
				var expected = 'Total: [\u2714~/       ] 2/10\n' +
					'Passed: 1  Failed: 0  Skipped: 1\n';

				renderer.recordPassed();
				renderer.recordSkipped();
				renderer.render();
				assert.strictEqual(mockCharm.write.str, expected);
				assert.isFalse(renderer.needsRender);
			}
		};
	});
});