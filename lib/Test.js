define([
	'dojo-ts/_base/declare',
	'dojo-ts/Stateful',
	'dojo-ts/Deferred',
	'dojo-ts/when',
	'dojo-ts/errors/CancelError',
	'dojo-ts/topic'
], function (declare, Stateful, Deferred, when, CancelError, topic) {
	return declare(Stateful, {
		name: '',
		test: null,
		parent: null,
		timeout: 5000,
		isAsync: false,
		timeElapsed: null,
		error: null,

		/**
		 * The unique identifier of the test, assuming all combinations of suite + test are unique.
		 */
		_idGetter: function () {
			var name = [],
				object = this;

			do {
				name.unshift(object.name);
			} while ((object = object.parent));

			return name.join(' - ');
		},

		/**
		 * The WebDriver interface for driving a remote environment.
		 * @see Suite#remote
		 */
		_remoteGetter: function () {
			return this.parent.get('remote');
		},

		_sessionIdGetter: function () {
			return this.parent.get('sessionId');
		},

		/**
		 * A convenience function that generates and returns a special Deferred that can be used for asynchronous
		 * testing.
		 * Once called, a test is assumed to be asynchronous no matter its return value (the generated Deferred's
		 * promise will always be used as the implied return value if a promise is not returned by the test function).
		 *
		 * @param timeout
		 * If provided, the amount of time to wait before rejecting the test with a timeout error, in milliseconds.
		 *
		 * @param numCallsUntilResolution
		 * The number of times that resolve needs to be called before the Deferred is actually resolved.
		 *
		 * @returns {dojo-ts/Deferred}
		 */
		async: function (/**?number*/ timeout, /**?number */ numCallsUntilResolution) {
			this.isAsync = true;

			if (timeout != null) {
				this.timeout = timeout;
			}

			if (!numCallsUntilResolution) {
				numCallsUntilResolution = 1;
			}

			var dfd = new Deferred();

			var oldResolve = dfd.resolve;
			dfd.resolve = function () {
				--numCallsUntilResolution;
				if (numCallsUntilResolution === 0) {
					oldResolve.apply(this, arguments);
				}
				else if (numCallsUntilResolution < 0) {
					throw new Error('resolve called too many times');
				}
			};
			dfd.callback = function (callback) {
				var self = this;
				return self.rejectOnError(function () {
					callback.apply(this, arguments);
					self.resolve();
				});
			};
			dfd.rejectOnError = function (callback) {
				var self = this;
				return function () {
					try {
						callback.apply(this, arguments);
					}
					catch (error) {
						self.reject(error);
					}
				};
			};

			// A test may call this function multiple times and should always get the same Deferred
			this.async = function () {
				return dfd;
			};
			return dfd;
		},

		/**
		 * Runs the test.
		 * @returns {dojo-ts/promise/Promise}
		 */
		run: function () {
			function handleTestError(error) {
				self.timeElapsed = new Date().getTime() - startTime;
				self.error = error;
				topic.publish('/test/fail', self);
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
				var startTime = new Date().getTime();
				result = self.test();

				if (self.isAsync && (!result || !result.then)) {
					result = self.async().promise;
				}

				if (result && result.then) {
					self.isAsync = true;
					timer = setTimeout(function () {
						// Cancelling the promise will trigger errback
						result.cancel(new CancelError('Timeout reached'));
					}, self.timeout);
				}

				when(result).then(function () {
					self.timeElapsed = new Date().getTime() - startTime;
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
				sessionId: this.get('sessionId'),
				id: this.get('id'),
				timeout: this.timeout,
				timeElapsed: this.timeElapsed,
				error: this.error ? {
					name: this.error.name,
					message: this.error.message,
					stack: this.error.stack
				} : null
			};
		}
	});
});