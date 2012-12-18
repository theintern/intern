define([
	'dojo/Deferred',
	'dojo/promise/when',
	'dojo/errors/CancelError',
	'dojo/topic'
], function (Deferred, when, CancelError, topic) {
	function Test(kwArgs) {
		for (var k in kwArgs) {
			this[k] = kwArgs[k];
		}
	}

	Test.prototype = {
		constructor: Test,
		name: '',
		test: null,
		timeout: 5000,

		/**
		 * Runs the test.
		 * @returns {dojo/promise/Promise}
		 */
		run: function () {
			function handleTestError(error) {
				topic.publish('/test/fail', self, {
					error: error,
					timeElapsed: Date.now() - startTime
				});
				topic.publish('/error', error);
				finishRun();
				dfd.reject(error);
			}

			function finishRun() {
				clearTimeout(timer);
				topic.publish('/test/end', self);
			}

			var self = this,
				dfd = new Deferred(),
				result,
				timer;

			topic.publish('/test/start', self);
			try {
				var startTime = Date.now();
				result = self.test();

				if (result && result.then) {
					timer = setTimeout(function () {
						// Cancelling the promise will trigger errback
						result.cancel(new CancelError('Timeout reached'));
					}, self.timeout);
				}

				when(result).then(function () {
					topic.publish('/test/pass', self, { timeElapsed: Date.now() - startTime });
					finishRun();
					dfd.resolve();
				}, handleTestError);
			} catch (error) {
				handleTestError(error);
			}

			return dfd.promise;
		}
	};

	return Test;
});