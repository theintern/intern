define([
	'dojo/_base/declare',
	'dojo/Stateful',
	'dojo/Deferred',
	'dojo/when',
	'dojo/errors/CancelError',
	'dojo/topic'
], function (declare, Stateful, Deferred, when, CancelError, topic) {
	return declare(Stateful, {
		name: '',
		test: null,
		parent: null,
		timeout: 30000,
		isAsync: false,
		timeElapsed: null,
		hasPassed: false,
		error: null,

		constructor: function () {
			topic.publish('/test/new', this);
		},

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
		 * @returns {dojo/Deferred}
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

			/**
			 * Eventually resolves the deferred, once `resolve` has been called as many times as specified by the
			 * `numCallsUntilResolution` parameter of the original `async` call.
			 */
			dfd.resolve = function () {
				--numCallsUntilResolution;
				if (numCallsUntilResolution === 0) {
					oldResolve.apply(this, arguments);
				}
				else if (numCallsUntilResolution < 0) {
					throw new Error('resolve called too many times');
				}
			};

			/**
			 * Wraps any callback to resolve the deferred so long as the callback executes without throwing any Errors.
			 */
			dfd.callback = function (callback) {
				var self = this;
				return self.rejectOnError(function () {
					callback.apply(this, arguments);
					self.resolve();
				});
			};

			/**
			 * Wraps a callback to reject the deferred if the callback throws an Error.
			 */
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
		 * @returns {dojo/promise/Promise}
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
						// Cancelling the promise will trigger errback,
						// though not all promise libraries provide cancellable promises
						result.cancel && result.cancel(new CancelError('Timeout reached on ' + self.get('id')));
					}, self.timeout);
				}

				when(result).then(function () {
					self.timeElapsed = new Date().getTime() - startTime;
					self.hasPassed = true;
					topic.publish('/test/pass', self);
					finishRun();
					dfd.resolve();
				}, handleTestError);
			}
			catch (error) {
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
				hasPassed: this.hasPassed,
				error: this.error ? {
					name: this.error.name,
					message: this.error.message,
					stack: this.error.stack
				} : null
			};
		}
	});
});
