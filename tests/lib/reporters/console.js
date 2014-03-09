define([
	'intern!object',
	'intern/chai!assert',
	'dojo/lang',
	'../../../lib/Suite',
	'../../../lib/Test',
	'../../../lib/BenchmarkSuite',
	'../../../lib/reporters/console'
], function (registerSuite, assert, lang, Suite, Test, BenchmarkSuite, reporter) {
	if (typeof console !== 'object') {
		// IE<10 does not provide a global console object when Developer Tools is turned off
		return;
	}

	var hasGrouping = 'group' in console && 'groupEnd' in console;

	var noop = Function.prototype;

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
		name: 'intern/lib/reporters/console',

		'/suite/start': function () {
			if (!hasGrouping) {
				return;
			}

			var called = false,
				suite = new Suite({ name: 'suite' }),
				handle = mockConsole('group', function (message) {
					called = true;
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

		'/suite/end': (function () {
			var suite = {
				'successful suite': function () {
					var actualMessage,
						suite = new Suite({ name: 'suite', tests: [ new Test({ hasPassed: true }) ] }),
						handle = mockConsole('info', function (message) {
							actualMessage = message;
						});

					try {
						reporter['/suite/end'](suite);
						assert.ok(actualMessage, 'console.info should be called when the reporter /suite/end method is called and there are no errors');
						assert.include(actualMessage, ' ' + suite.numTests - suite.numFailedTests + '/' + suite.numTests + ' ', 'console.info message should say how many tests passed and how many total tests existed');
					}
					finally {
						handle.remove();
					}
				},

				'failed suite': function () {
					var actualMessage,
						suite = new Suite({ name: 'suite', tests: [ new Test({ hasPassed: false }) ] }),
						handle = mockConsole('warn', function (message) {
							actualMessage = message;
						});

					try {
						reporter['/suite/end'](suite);
						assert.ok(actualMessage, 'console.warn should be called when the reporter /suite/end method is called and there are errors');
						assert.include(actualMessage, ' ' + suite.numTests - suite.numFailedTests + '/' + suite.numTests + ' ', 'console.warn message should say how many tests passed and how many total tests existed');
					}
					finally {
						handle.remove();
					}
				}
			};

			if (hasGrouping) {
				var groupHandle;
				lang.mixin(suite, {
					setup: function () {
						groupHandle = mockConsole('groupEnd', function () {
							// no-op to prevent code under test from calling `console.groupEnd` to close this
							// test group
						});
					},

					teardown: function () {
						groupHandle.remove();
					},

					'grouping': function () {
						var called = false,
							suite = new Suite({ name: 'suite' }),
							handles = [
								mockConsole('groupEnd', function (name) {
									called = true;
									assert.strictEqual(name, suite.name, 'console.groupEnd should be called with the name of the suite');
								}),
								mockConsole('info', function () {
									// no-op to prevent code from intercepting the /group/end topic and emitting test
									// pass information for the fake suite
								})
							];

						try {
							reporter['/suite/end'](suite);
							assert.isTrue(called, 'console.group should be called when the reporter /suite/end method is called');
						}
						finally {
							var handle;
							while ((handle = handles.pop())) {
								handle.remove();
							}
						}
					}
				});
			}

			return suite;
		})(),

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
		},

		'/bench/start': function () {
			var called = false,
				bench = new BenchmarkSuite({ name: 'bench' });
				handle = hasGrouping ? mockConsole('group', function (message) {
					called = true;
					assert.strictEqual(message, bench.name, 'console.group should be called with the name of the bench');
				}) : mockConsole('log', function (message) {
					called = true;
					assert.strictEqual(message, 'START: ' + bench.id, 'console.log should be called with the ID of the bench');
				});

			try {
				reporter['/bench/start'](bench);
				assert.isTrue(called, 'console.group || console.log should be called when the reporter /bench/start methid is called');
			}
			finally {
				handle.remove();
			}
		},

		'/bench/cycle': {
			'benchmark': function () {
				var result = [],
					expectedResult = [
						hasGrouping ? 'foo' : 'bench - foo',
						'Operations/Sec: 99.12',
						'Relative Margin of Error: \xb19.12%',
						'Samples: 2'
					],
					bench = new BenchmarkSuite({
						name: 'bench',
						id: 'bench',
						type: 'benchmark',
						event: {
							target: {
								name: 'foo',
								hz: 99.12345,
								stats: {
									rme: 9.1234,
									sample: [ 1, 2 ],
									mean: 1.234567,
									deviation: 1.234567,
									variance: 1.234567,
									moe: 1.234567,
									sem: 1.234567
								},
								times: {
									cycle: 1.123457
								}
							}
						}
					}),
					handles = [
						mockConsole('log', function () {
							result = result.concat([].slice.call(arguments, 0));
						}),
						mockConsole('group', function () {
							result = result.concat([].slice.call(arguments, 0));
						}),
						mockConsole('groupEnd', noop)
					];

				try {
					reporter['/bench/cycle'](bench);
					assert.deepEqual(result, expectedResult, 'The console has logged the right information for /bench/cycle');
				}
				finally {
					var handle;
					while ((handle = handles.pop())) {
						handle.remove();
					}
				}
			},

			'baseline': function () {
				var result = [],
					expectedResult = [
						hasGrouping ? 'foo' : 'bench - foo',
						'Operations/Sec: 99.12',
						'Relative Margin of Error: \xb19.12%',
						'Samples: 2',
						'Mean: 1234.57ms',
						'Deviation: \xb11234.57ms',
						'Variance: \xb11234.57ms',
						'Margin of Error: \xb11234.57ms',
						'Standard Error of Mean: \xb11234.57ms',
						'Cycle Time: 1123.46ms'
					],
					bench = new BenchmarkSuite({
						name: 'bench',
						id: 'bench',
						type: 'baseline',
						event: {
							target: {
								name: 'foo',
								hz: 99.12345,
								stats: {
									rme: 9.1234,
									sample: [ 1, 2 ],
									mean: 1.234567,
									deviation: 1.234567,
									variance: 1.234567,
									moe: 1.234567,
									sem: 1.234567
								},
								times: {
									cycle: 1.123457
								}
							}
						}
					}),
					handles = [
						mockConsole('log', function () {
							result = result.concat([].slice.call(arguments, 0));
						}),
						mockConsole('group', function () {
							result = result.concat([].slice.call(arguments, 0));
						}),
						mockConsole('groupEnd', noop)
					];

				try {
					reporter['/bench/cycle'](bench);
					assert.deepEqual(result, expectedResult, 'The console has logged the right information for /bench/cycle');
				}
				finally {
					var handle;
					while ((handle = handles.pop())) {
						handle.remove();
					}
				}
			},

			'grouping': function () {
				if (!hasGrouping) {
					return;
				}

				var called = false,
					bench = new BenchmarkSuite({
						name: 'suite',
						event: {
							target: {
								name: 'foo',
								hz: 99.12345,
								stats: {
									rme: 9.1234,
									sample: [ 1, 2 ],
									mean: 1.234567,
									deviation: 1.234567,
									variance: 1.234567,
									moe: 1.234567,
									sem: 1.234567
								},
								times: {
									cycle: 1.123457
								}
							}
						}
					}),
					handles = [
						mockConsole('groupEnd', function () {
							called = true;
							assert.strictEqual(arguments.length, 0, '.groupEnd() should be called with no arguments when the reporter /bench/end method is called');
						}),
						mockConsole('log', noop),
						mockConsole('group', noop)
					];

				try {
					reporter['/bench/cycle'](bench);
					assert.isTrue(called, 'console.group should be called when the reporter /bench/cycle method is called');
				}
				finally {
					var handle;
					while ((handle = handles.pop())) {
						handle.remove();
					}
				}
			}
		},

		'/bench/end': {
			'baseline': {
				'successful': function () {
					function pluck() {
						return 'foo';
					}

					var result = [],
						expectedResult = [
							'Elapsed: 5 secs',
							'2/2 tests completed'
						],
						bench = new BenchmarkSuite({
							name: 'bench',
							id: 'bench',
							type: 'baseline',
							event: { target: { times: { elapsed: 5 } } }
						}),
						handles = [
							mockConsole('log', function () {
								result = result.concat([].slice.call(arguments, 0));
							}),
							mockConsole('info', function () {
								result = result.concat([].slice.call(arguments, 0));
							}),
							mockConsole('groupEnd', noop)
						];

					// During construction a suite is created, so has to be overridden after construction
					bench.suite = {
						length: 2,
						filter: function (value) {
							switch (value) {
							case 'successful':
								return { length: 2 };
							case 'fastest':
								return { pluck: pluck };
							case 'slowest':
								return { pluck: pluck };
							}
						}
					};

					try {
						reporter['/bench/end'](bench);
						assert.deepEqual(result, expectedResult, 'The console has logged the right information for /bench/end');
					}
					finally {
						var handle;
						while ((handle = handles.pop())) {
							handle.remove();
						}
					}
				},

				'failed': function () {
					function pluck() {
						return 'foo';
					}

					var result = [],
						expectedResult = [
							'Elapsed: 5 secs',
							'1/2 tests completed'
						],
						bench = new BenchmarkSuite({
							name: 'bench',
							id: 'bench',
							type: 'baseline',
							event: { target: { times: { elapsed: 5 } } }
						}),
						handles = [
							mockConsole('log', function () {
								result = result.concat([].slice.call(arguments, 0));
							}),
							mockConsole('warn', function () {
								result = result.concat([].slice.call(arguments, 0));
							}),
							mockConsole('groupEnd', noop)
						];

					// During construction a suite is created, so has to be overridden after construction
					bench.suite = {
						length: 2,
						filter: function (value) {
							switch (value) {
							case 'successful':
								return { length: 1 };
							case 'fastest':
								return { pluck: pluck };
							case 'slowest':
								return { pluck: pluck };
							}
						}
					};

					try {
						reporter['/bench/end'](bench);
						assert.deepEqual(result, expectedResult, 'The console has logged the right information for /bench/end');
					}
					finally {
						var handle;
						while ((handle = handles.pop())) {
							handle.remove();
						}
					}
				}
			},

			'benchmark': {
				'successful': function () {
					function pluck() {
						return 'foo';
					}

					var result = [],
						expectedResult = [ 'Fastest: "foo" Slowest: "foo" - 2/2 tests completed' ],
						bench = new BenchmarkSuite({
							name: 'bench',
							id: 'bench',
							type: 'benchmark',
							event: { target: { times: { elapsed: 5 } } }
						}),
						handles = [
							mockConsole('log', function () {
								result = result.concat([].slice.call(arguments, 0));
							}),
							mockConsole('info', function () {
								result = result.concat([].slice.call(arguments, 0));
							}),
							mockConsole('groupEnd', noop)
						];

					// During construction a suite is created, so has to be overridden after construction
					bench.suite = {
						length: 2,
						filter: function (value) {
							switch (value) {
							case 'successful':
								return { length: 2 };
							case 'fastest':
								return { pluck: pluck };
							case 'slowest':
								return { pluck: pluck };
							}
						}
					};

					try {
						reporter['/bench/end'](bench);
						assert.deepEqual(result, expectedResult, 'The console has logged the right information for /bench/end');
					}
					finally {
						var handle;
						while ((handle = handles.pop())) {
							handle.remove();
						}
					}
				},

				'failed': function () {
					function pluck() {
						return 'foo';
					}

					var result = [],
						expectedResult = [ 'Fastest: "foo" Slowest: "foo" - 1/2 tests completed' ],
						bench = new BenchmarkSuite({
							name: 'bench',
							id: 'bench',
							type: 'benchmark',
							event: { target: { times: { elapsed: 5 } } }
						}),
						handles = [
							mockConsole('log', function () {
								result = result.concat([].slice.call(arguments, 0));
							}),
							mockConsole('warn', function () {
								result = result.concat([].slice.call(arguments, 0));
							}),
							mockConsole('groupEnd', noop)
						];

					// During construction a suite is created, so has to be overridden after construction
					bench.suite = {
						length: 2,
						filter: function (value) {
							switch (value) {
							case 'successful':
								return { length: 1 };
							case 'fastest':
								return { pluck: pluck };
							case 'slowest':
								return { pluck: pluck };
							}
						}
					};

					try {
						reporter['/bench/end'](bench);
						assert.deepEqual(result, expectedResult, 'The console has logged the right information for /bench/end');
					}
					finally {
						var handle;
						while ((handle = handles.pop())) {
							handle.remove();
						}
					}
				}
			},

			'grouping': function () {
				if (!hasGrouping) {
					return;
				}

				var called = false,
					bench = new BenchmarkSuite({ name: 'bench' }),
					handles = [
						mockConsole('groupEnd', function () {
							called = true;
							assert.strictEqual(arguments.length, 0, '.groupEnd() should be called with no arguments when the reporter /bench/end method is called');
						}),
						mockConsole('log', noop),
						mockConsole('info', noop)
					];

				try {
					reporter['/bench/end'](bench);
					assert.isTrue(called, 'console.group should be called when the reporter /bench/end method is called');
				}
				finally {
					var handle;
					while ((handle = handles.pop())) {
						handle.remove();
					}
				}
			}
		},

		'/bench/error': function () {
			var result = [],
				error = new Error('Oops'),
				bench = new BenchmarkSuite({
					name: 'bench',
					id: 'bench',
					error: error,
					event: { target: { name: 'foo', error: error } }
				}),
				handle = mockConsole('error', function () {
					result = result.concat([].slice.call(arguments, 0));
				});

			try {
				reporter['/bench/error'](bench);

				assert.strictEqual(result.length, 3, 'Reporter should log three messages for an error with a related test');
				result = result.join('\n');
				assert.include(result, 'ERROR: ' + (hasGrouping ? 'foo' : 'bench - foo'), 'Reporter should indicate which suite threw an error');
			}
			finally {
				handle.remove();
			}
		}
	});
});
