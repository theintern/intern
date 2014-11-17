define([
	'intern!object',
	'intern/chai!assert',
	'../../../../../lib/reporters/pretty/RemoteRenderer'
], function (registerSuite, assert, RemoteRenderer) {
	var mockCharm;

	registerSuite({
		name: 'intern/lib/reporters/pretty/RemoteRenderer',

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
				}
			};
		},

		'construction': {
			'unit construction': function () {
				var renderer = new RemoteRenderer(mockCharm, 'UNIT');
				assert.strictEqual(renderer.height, 1);
				assert.strictEqual(renderer.numTests, 0);
				assert.strictEqual(renderer.title, '            ');
				assert.isTrue(renderer.needsRender);
				assert.throws(function () {
					renderer.recordPassed();
				}, Error, '', 'Results cannot be recorded until the number of tests are provided');
			},

			'functional construction': function () {
				var renderer = new RemoteRenderer(mockCharm, 'FUNC', 'IE 8', 100);
				assert.strictEqual(renderer.height, 1);
				assert.strictEqual(renderer.numTests, 100);
				assert.strictEqual(renderer.title, 'IE 8:       ');
				assert.isTrue(renderer.needsRender);
				assert.doesNotThrow(function () {
					renderer.recordPassed();
				});
			}
		},

		'.height': function () {
			var renderer = new RemoteRenderer(mockCharm, 'TEST');
			assert.strictEqual(renderer.height, 1);
		},

		'.needsRenderer': {
			'is true when dirty': function () {
				var renderer = new RemoteRenderer(mockCharm, 'TEST');
				renderer._dirty = true;
				assert.isTrue(renderer.needsRender);
			},

			'is false when not dirty': function () {
				var renderer = new RemoteRenderer(mockCharm, 'TEST');
				renderer._dirty = false;
				assert.isFalse(renderer.needsRender);
			}
		},

		'.numTests': {
			'uninitialized returns 0': function () {
				var renderer = new RemoteRenderer(mockCharm, 'TEST');
				assert.strictEqual(renderer.numTests, 0);
			},

			'initialized returns value': function () {
				var renderer = new RemoteRenderer(mockCharm, 'TEST', 'TITLE', 1);
				assert.strictEqual(renderer.numTests, 1);
			},

			'set updates values and sets dirty': function () {
				var renderer = new RemoteRenderer(mockCharm, 'TEST');
				renderer._dirty = false;
				renderer.numTests = 100;
				assert.strictEqual(renderer.numTests, 100);
				assert.isTrue(renderer.needsRender);
			},

			'setting same value does not make dirty': function () {
				var expected = 100;
				var renderer = new RemoteRenderer(mockCharm, 'TEST', 'TITLE', expected);
				renderer._dirty = false;
				renderer.numTests = expected;
				assert.strictEqual(renderer.numTests, expected);
				assert.isFalse(renderer.needsRender);
			}
		},

		'.title': {
			'uninitialized returns correctly spaced string': function () {
				var renderer = new RemoteRenderer(mockCharm, 'TEST');
				assert.strictEqual(renderer.title, '            ');
			},

			'short title is reformatted': function () {
				var renderer = new RemoteRenderer(mockCharm, 'TEST', 'TITLE');
				assert.strictEqual(renderer.title, 'TITLE:      ');
			},

			'long title is shortened to fit': function () {
				var renderer = new RemoteRenderer(mockCharm, 'TEST', 'TITLE1234567890');
				assert.strictEqual(renderer.title, 'TITLE12345: ');
			},
			
			'dirty flag is set': function () {
				var renderer = new RemoteRenderer(mockCharm, 'TEST');
				renderer._dirty = false;
				renderer.title = 'TITLE';
				assert.isTrue(renderer.needsRender);
			},

			'. is removed from the end of a title': function () {
				var renderer = new RemoteRenderer(mockCharm, 'TEST', 'Chr Ver 2.0.1');
				assert.strictEqual(renderer.title, 'Chr Ver 2:  ');
			},

			'environment object is stringified': function () {
				var env = { browserName: 'internet explorer',
					platform: 'Linux',
					version: '10'
				};
				var renderer = new RemoteRenderer(mockCharm, 'TEST', env);
				assert.strictEqual(renderer.title, 'IE *nix 10: ');
			},

			'empty environment object': function () {
				var renderer = new RemoteRenderer(mockCharm, 'TEST', {});
				assert.strictEqual(renderer.title, 'Any:        ');
			}
		},

		'.recordPassed': function () {
			var renderer = new RemoteRenderer(mockCharm, 'TEST', 'TITLE', 100);
			renderer._dirty = false;
			renderer.recordPassed();
			assert.isTrue(renderer.needsRender);
		},

		'.recordSkipped': function () {
			var renderer = new RemoteRenderer(mockCharm, 'TEST', 'TITLE', 100);
			renderer._dirty = false;
			renderer.recordSkipped();
			assert.isTrue(renderer.needsRender);
		},

		'.recordFailed': function () {
			var renderer = new RemoteRenderer(mockCharm, 'TEST', 'TITLE', 100);
			renderer._dirty = false;
			renderer.recordFailed();
			assert.isTrue(renderer.needsRender);
		},

		'.render': {
			'renderers pending when numTests is not set': function () {
				var renderer = new RemoteRenderer(mockCharm, 'UNIT');
				renderer.render();
				assert.strictEqual(mockCharm.write.str, '            UNIT Pending\n');
				assert.isFalse(renderer.needsRender);
			},

			'renders progress': function () {
				var renderer = new RemoteRenderer(mockCharm, 'FUNC', 'TITLE', 10);
				renderer.render();
				assert.strictEqual(mockCharm.write.str, 'TITLE:      FUNC [/         ] 0/10\n');
				assert.isFalse(renderer.needsRender);
			}
		}
	});
});