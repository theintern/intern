define([
	'intern!object',
	'intern/chai!assert',
	'../../lib/thresholdCheck',
	'dojo/Evented'
], function (registerSuite, assert, coverageThresholdCheck, Evented) {

	var thresholds = {
		covered: {
			expectedGood: {
				lines: 100,
				functions: 0,
				statements: 32,
				branches: 82
			},
			expectedBad: {
				lines: 100,
				functions: 1,
				statements: 32,
				branches: 82
			}
		},
		uncovered: {
			expectedGood: {
				lines: -10,
				functions: -10,
				statements: -2,
				branches: -2
			},
			expectedBad: {
				lines: -10,
				functions: -10,
				statements: -1,
				branches: -2
			}
		}

	};
	var mockCoverage = {
		'test.js': {
			'path': 'test.js',
			's': {
				'1': 1,
				'2': 0,
				'3': 0
			},
			'b': {
				'1': [
					0,1
				],
				'2': [
					1,1
				],
				'3': [
					1,1
				]
			},
			'f': {
				'1': 0
			},
			'fnMap': {
				'1': {
					'start': {
						'line': 1,
						'column': 0
					},
					'end': {
						'line': 60,
						'column': 3
					}
				}
			},
			'statementMap': {
				'1': {
					'start': {
						'line': 1,
						'column': 0
					},
					'end': {
						'line': 60,
						'column': 3
					}
				},
				'2': {
					'start': {
						'line': 1,
						'column': 0
					},
					'end': {
						'line': 10,
						'column': 2
					}
				},
				'3': {
					'start': {
						'line': 1,
						'column': 0
					},
					'end': {
						'line': 10,
						'column': 2
					}
				}
			},
			'branchMap': {
				'1': {
					'start': {
						'line': 1,
						'column': 0
					},
					'end': {
						'line': 60,
						'column': 3
					}
				},
				'2': {
					'start': {
						'line': 1,
						'column': 0
					},
					'end': {
						'line': 10,
						'column': 2
					}
				},
				'3': {
					'start': {
						'line': 1,
						'column': 0
					},
					'end': {
						'line': 10,
						'column': 2
					}
				}

			}
		}
	};

	function getMockTopic() {

		var hub = new Evented();
		var mock = {
			publish: function () {
				this.publish.called++;
				this.publish.args.push(arguments);
				return hub.emit.apply(hub, arguments);
			},
			subscribe: function () {
				this.subscribe.called++;
				this.subscribe.args.push(arguments);
				return hub.on.apply(hub, arguments);
			}

		};

		mock.publish.called = 0;
		mock.publish.args = [];
		mock.subscribe.called = 0;
		mock.subscribe.args = [];

		return mock;
	}

	function getCoverageErrors(topic) {
		var argForCall;
		for (var i = 0; i < topic.publish.args.length; i++) {
			argForCall = topic.publish.args[i];
			if (argForCall[0] === '/coverage/error') {
				return argForCall[2];
			}
		}
	}

	registerSuite({
		name: 'intern/lib/thresholdCheck',

		thresholds: {
			covered: {
				'within': function () {
					var topic = getMockTopic();
					coverageThresholdCheck(topic, thresholds.covered.expectedGood);
					topic.publish('/coverage', null, mockCoverage);
					assert.isUndefined(getCoverageErrors(topic));
				},
				outside: function () {
					var topic = getMockTopic();
					coverageThresholdCheck(topic, thresholds.covered.expectedBad);
					topic.publish('/coverage', null, mockCoverage);
					assert.equal(getCoverageErrors(topic), 'Coverage for functions (0%) does not meet threshold (1%)');
				}

			},
			uncovered: {
				'within': function () {
					var topic = getMockTopic();
					coverageThresholdCheck(topic, thresholds.uncovered.expectedGood);
					topic.publish('/coverage', null, mockCoverage);
					assert.isUndefined(getCoverageErrors(topic));
				},
				outside: function () {
					var topic = getMockTopic();
					coverageThresholdCheck(topic, thresholds.uncovered.expectedBad);
					topic.publish('/coverage', null, mockCoverage);
					assert.equal(getCoverageErrors(topic), 'Uncovered count for statements (2) exceeds threshold (1)');
				}
			}
		},

		topics: {
			remoteSessions: {
				'subscribe#/coverage': function () {
					var topic = getMockTopic();
					coverageThresholdCheck(topic, thresholds.covered.expectedGood, true);
					assert.equal(topic.subscribe.called, 3);
					assert.equal(topic.subscribe.args[2][0], '/coverage');
				},
				'subscribe#/session/start': function () {
					var topic = getMockTopic();
					coverageThresholdCheck(topic, thresholds.covered.expectedGood, true);
					assert.equal(topic.subscribe.called, 3);
					assert.equal(topic.subscribe.args[0][0], '/session/start');
				},
				'subscribe#/session/end': function () {
					var topic = getMockTopic();
					coverageThresholdCheck(topic, thresholds.covered.expectedGood, true);
					assert.equal(topic.subscribe.called, 3);
					assert.equal(topic.subscribe.args[1][0], '/session/end');
				}
			},
			localSession: {
				topics: {
					'subscribe#/coverage': function () {
						var topic = getMockTopic();
						coverageThresholdCheck(topic, thresholds.covered.expectedGood);
						assert.equal(topic.subscribe.called, 1);
						assert.equal(topic.subscribe.args[0][0], '/coverage');
					}
				}
			}
		}
	});
});
