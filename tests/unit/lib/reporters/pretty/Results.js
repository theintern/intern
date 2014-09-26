define([
	'intern!object',
	'intern/chai!assert',
	'../../../../../lib/reporters/pretty/Results'
], function (registerSuite, assert, Results) {
	registerSuite({
		name: 'Results',

		'constructor': {
			'normal construction': function () {
				var total = 100;
				var maxGroups = 10;
				var result = new Results(total, maxGroups);

				assert.strictEqual(result.total, total);
				assert.strictEqual(result.passed, 0);
				assert.strictEqual(result.failed, 0);
				assert.strictEqual(result.skipped, 0);
				assert.strictEqual(result.complete, 0);
				assert.strictEqual(result.maxGroups, maxGroups);
				assert.strictEqual(result.numGroups, maxGroups);
			},

			'total is less than maxGroups': function () {
				var total = 5;
				var maxGroups = 10;
				var result = new Results(total, maxGroups);

				assert.strictEqual(result.numGroups, total);
			}
		},

		'recordPassed': function () {
			var result = new Results(100, 10);
			result.recordPassed();
			assert.strictEqual(result.passed, 1);
			assert.strictEqual(result.getStatus(0), 'pass');
			assert.strictEqual(result.complete, 1);
		},

		'recordFailed': function () {
			var result = new Results(100, 10);
			result.recordFailed();
			assert.strictEqual(result.failed, 1);
			assert.strictEqual(result.getStatus(0), 'fail');
			assert.strictEqual(result.complete, 1);
		},

		'recordSkipped': function () {
			var result = new Results(100, 10);
			result.recordSkipped();
			assert.strictEqual(result.skipped, 1);
			assert.strictEqual(result.getStatus(0), 'skip');
			assert.strictEqual(result.complete, 1);
		},

		'getStatus': (function() {
		    var result = new Results(100, 10);
			result.recordPassed();
			result.recordSkipped();
			result.recordFailed();

			return {
				'reports passed': function () {
					assert.strictEqual(result.getStatus(0), 'pass');
				},

				'reports skipped': function () {
					assert.strictEqual(result.getStatus(1), 'skip');
				},

				'reports failed': function () {
					assert.strictEqual(result.getStatus(2), 'fail');
				},

				'reports pending': function () {
					assert.strictEqual(result.getStatus(3), 'pending');
				}
			};
		})(),

		'getGroup': {
			'tests are grouped properly before the remainder': function () {
				var result = new Results(25, 10);
				var expectedGroup, i, message;

				for(i = 0; i < 15; i++) {
					expectedGroup = (i - (i % 3)) / 3;
					message = 'test ' + i + ' should be in group ' + expectedGroup;
					assert.isTrue(expectedGroup < 5, 'out of range');
					assert.strictEqual(result.getGroup(i), expectedGroup, message);
				}
			},

			'tests are grouped properly after the remainder': function () {
				var result = new Results(25, 10);
				var expectedGroup, i, testNum, message;

				for(i = 0; i < 10; i++) {
					testNum = i + 15;
					expectedGroup = (i - (i % 2)) / 2 + 5;
					message = 'test ' + testNum + ' should be in group ' + expectedGroup;
					assert.isTrue(expectedGroup >= 5 && expectedGroup < 10, 'out of range: ' + expectedGroup);
					assert.strictEqual(result.getGroup(testNum), expectedGroup, message);
				}
			}
		},
		
		'getGroupResult': {
			'pending': function () {
				var results = new Results(25, 10);

				assert.strictEqual(results.getGroupResult(0), 'pending');
			},

			'pending while group not complete': function () {
				var results = new Results(25, 10);

				assert.strictEqual(results.getGroupResult(0), 'pending');

				results.recordPassed();
				assert.strictEqual(results.getGroupResult(0), 'pending');

				results.recordPassed();
				assert.strictEqual(results.getGroupResult(0), 'pending');
			},

			'all passed': function () {
				var results = new Results(25, 10);

				results.recordPassed();
				results.recordPassed();
				results.recordPassed();
				assert.strictEqual(results.getGroupResult(0), 'pass');
			},

			'skipped': function () {
				var results = new Results(25, 10);

				results.recordSkipped();
				assert.strictEqual(results.getGroupResult(0), 'skip');

				results.recordPassed();
				assert.strictEqual(results.getGroupResult(0), 'skip');

				results.recordSkipped();
				assert.strictEqual(results.getGroupResult(0), 'skip');
			},

			'one failed': function () {
				var results = new Results(25, 10);

				results.recordFailed();
				assert.strictEqual(results.getGroupResult(0), 'fail');

				results.recordPassed();
				assert.strictEqual(results.getGroupResult(0), 'fail');

				results.recordSkipped();
				assert.strictEqual(results.getGroupResult(0), 'fail');
			}
		},

		'full run': function () {
			var results = new Results(11, 5);

			results.recordPassed();
			results.recordPassed();
			results.recordPassed();

			results.recordPassed();
			results.recordFailed();

			results.recordSkipped();
			results.recordPassed();

			results.recordPassed();
			results.recordPassed();

			results.recordPassed();
			results.recordPassed();

			assert.strictEqual(results.getGroupResult(0), 'pass');
			assert.strictEqual(results.getGroupResult(1), 'fail');
			assert.strictEqual(results.getGroupResult(2), 'skip');
			assert.strictEqual(results.getGroupResult(3), 'pass');
			assert.strictEqual(results.getGroupResult(4), 'pass');
		}
	});
});