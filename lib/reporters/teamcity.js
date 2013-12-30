/* jshint loopfunc: true */
/* globals console: true */

define([
	'intern/dojo/node!util',
	'intern/dojo/node!teamcity-service-messages'
], function(
	util,
	teamcity
) {

	return {

		/**
		 * Hook: test has started.
		 *
		 * @param  {Test} test
		 */
		'/test/start': function (test) {
			teamcity.testStarted({ name : test.id });
		},

		/**
		 * Hook: test has ended.
		 *
		 * @param  {Test} test
		 */
		'/test/end': function (test) {
			teamcity.testFinished({
				name: test.id,
				duration: test.timeElapsed
			});
		},

		/**
		 * Hook: test has failed.
		 *
		 * @param  {Test} test
		 */
		'/test/fail': function (test) {
			var message = new teamcity.Message('testFailed', {
				name: test.id,
				message: test.error.message
			});

			if (test.error.actual && test.error.expected) {
				message
					.arg('type', 'comparisonFailure')
					.arg('expected', test.error.expected)
					.arg('actual', test.error.actual);
			}

			console.log(message.toString());
		},

		/**
		 * Hook: suite has started.
		 *
		 * @param  {Suite} suite
		 */
		'/suite/start': function (suite) {
			if (suite.root) {
				return;
			}

			suite.startDate = new Date();

			teamcity.testSuiteStarted({
				name: suite.name,
				startDate: suite.startDate
			});
		},

		/**
		 * Hook: suite has ended.
		 *
		 * @param  {Suite} suite
		 */
		'/suite/end': function( suite ) {
			if (suite.root) {
				return;
			}

			teamcity.testSuiteFinished({
				name: suite.name,
				duration: new Date() - suite.startDate
			});
		}

	};

});
