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
		parent: null,
		timeout: 5000,
		timeElapsed: null,
		error: null,

		/**
		 * The unique identifier of the test, assuming all combinations of suite + test are unique.
		 */
		get id() {
			var name = [],
				object = this;

			do {
				name.unshift(object.name);
			} while ((object = object.parent));

			return name.join(' - ');
		},

		/**
		 * Runs the test.
		 * @returns {dojo/promise/Promise}
		 */
		run: function () {
			function handleTestError(error) {
				self.timeElapsed = Date.now() - startTime;
				self.error = error;
				topic.publish('/test/fail', self);
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
					self.timeElapsed = Date.now() - startTime;
					topic.publish('/test/pass', self);
					finishRun();
					dfd.resolve();
				}, handleTestError);
			} catch (error) {
				handleTestError(error);
			}

			return dfd.promise;
		},

		toJSON: function () {
			return {
				name: this.name,
				id: this.id,
				timeout: this.timeout,
				timeElapsed: this.timeElapsed,
				error: this.error
			};
		}
	};

	return Test;
});