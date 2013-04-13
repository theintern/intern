define([
	'teststack!object',
	'teststack/chai!assert',
	'../../../lib/Suite',
	'../../../lib/Test',
	'../../../lib/reporters/console'
], function (registerSuite, assert, Suite, Test, reporter) {
	if (typeof console !== 'object') {
		// IE<10 does not provide a global console object when Developer Tools is turned off
		return;
	}

	var hasGrouping = 'group' in console && 'groupEnd' in console;

	function mockConsole(method, callback) {
		var oldMethod = console[method];
		console[method] = callback;
		return {
			remove: function () {
				console[method] = oldMethod;
			}
		};
	}

	registerSuite({
		name: 'teststack/lib/reporters/console',

		'/suite/start': function () {
			if (!hasGrouping) {
				return;
			}

			var called = false,
				suite = new Suite({ name: 'suite' }),
				handle = mockConsole('group', function (message) {
					called = true;
					console.groupEnd();
					assert.strictEqual(message, suite.name, 'console.group should be called with the name of the suite');
				});

			try {
				reporter['/suite/start'](suite);
				assert.isTrue(called, 'console.group should be called when the reporter /suite/start method is called');
			}
			finally {
				handle.remove();
			}
		},

		'/suite/end': function () {
			if (!hasGrouping) {
				return;
			}

			var called = false,
				suite = new Suite({ name: 'suite' }),
				handle = mockConsole('groupEnd', function () {
					called = true;
				});

			try {
				reporter['/suite/end'](suite);
				assert.isTrue(called, 'console.group should be called when the reporter /suite/end method is called');
			}
			finally {
				handle.remove();
			}
		},

		'/suite/error': function () {
			var result = [],
				error = new Error('Oops'),
				suite = new Suite({
					name: 'suite',
					error: error
				}),
				handles = [
					mockConsole('warn', function () {
						result = result.concat([].slice.call(arguments, 0));
					}),
					mockConsole('error', function () {
						result = result.concat([].slice.call(arguments, 0));
					})
				];

			error.relatedTest = new Test({ name: 'related test', parent: suite });

			try {
				reporter['/suite/error'](suite);

				assert.strictEqual(result.length, 3, 'Reporter should log three messages for an error with a related test');
				result = result.join('\n');
				assert.match(result, /\bSUITE ERROR\b/, 'Reporter should indicate that a suite error occurred');
				assert.include(result, suite.id, 'Reporter should indicate which suite threw an error');
				assert.match(result, /\bRelated test\b/, 'Reporter should indicate there was a related test for the suite error');
				assert.include(result, hasGrouping ? error.relatedTest.name : error.relatedTest.id, 'Reporter should indicate the name of the related test');
			}
			finally {
				var handle;
				while ((handle = handles.pop())) {
					handle.remove();
				}
			}
		},

		'/test/pass': function () {
			var test = new Test({
					name: 'test',
					timeElapsed: 123,
					parent: { name: 'parent', id: 'parent' },
					hasPassed: true
				}),
				handle = mockConsole('log', function (message) {
					assert.match(message, /\bPASS\b/, 'Reporter should indicate that a test passed');
					assert.include(message, hasGrouping ? test.name : test.id, 'Reporter should indicate which test passed');
					assert.include(message, test.timeElapsed + 'ms', 'Reporter should indicate the amount of time the test took');
				});

			try {
				reporter['/test/pass'](test);
			}
			finally {
				handle.remove();
			}
		},

		'/test/fail': function () {
			var result = [],
				test = new Test({
					name: 'test',
					timeElapsed: 123,
					parent: { name: 'parent', id: 'parent' },
					error: new Error('Oops')
				}),
				handles = [
					mockConsole('log', function () {
						result = result.concat([].slice.call(arguments, 0));
					}),
					mockConsole('error', function () {
						result = result.concat([].slice.call(arguments, 0));
					})
				];

			try {
				reporter['/test/fail'](test);
				assert.strictEqual(result.length, 2, 'Reporter should log two messages for a failed test');
				result = result.join('\n');
				assert.match(result, /\bFAIL\b/, 'Reporter should indicate that a test failed');
				assert.include(result, hasGrouping ? test.name : test.id, 'Reporter should indicate which test failed');
				assert.include(result, test.timeElapsed + 'ms', 'Reporter should indicate the amount of time the test took');
			}
			finally {
				var handle;
				while ((handle = handles.pop())) {
					handle.remove();
				}
			}
		}
	});
});