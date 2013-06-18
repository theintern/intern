define([
	'dojo/Deferred',
	'dojo/promise/when',
	'dojo/topic',
	'benchmark'
], function (Deferred, when, topic, Benchmark) {

	/**
	 * A convenience function to handle calling of functions and dealing with promised returns
	 * @param  {Object} self The object that contains the function to be called
	 * @param  {String} name A string representing the function to be called
	 * @return {dojo/promise/Promise}
	 */
	function call(self, name) {
		var result;
		try {
			result = self[name] && self[name]();
		}
		catch (error) {
			var dfd = new Deferred();
			dfd.reject(error);
			result = dfd.promise;
		}

		return when(result);
	}

	/**
	 * Handle the completion of a BenchmarkSuite
	 * @param  {Event} event The event passed from the emitter
	 */
	function onComplete(event) {
		/**
		 * Resolves promises in the nextTick as per Promises A+
		 * TODO: Remove when dojo/promise is Promise A+
		 * @param  {Function} fn Function to call
		 */
		function nextTick(fn) {
			/*global process:false, setImmediate:false */
			if (typeof process !== 'undefined' && process.nextTick) {
				process.nextTick(fn);
			}
			else if (typeof setImmediate !== 'undefined') {
				setImmediate(fn);
			}
			else {
				setTimeout(fn, 0);
			}
		}

		var self = this;
		self.inOnComplete = true;
		nextTick(function () {
			self.event = event;
			if (self.publishAfterSetup) {
				topic.publish('/bench/end', self);
			}
			call(self, 'teardown').then(function () {
				if (!self.publishAfterSetup) {
					topic.publish('/bench/end', self);
				}
				self.error ? self.dfd.reject(self.error) : self.dfd.resolve();
				self.inOnComplete = false;
			}, function (error) {
				self.error = error;
				topic.publish('/bench/error', self);
				topic.publish('/error', error);
				self.dfd.reject(error);
				self.inOnComplete = false;
			});
		});
	}

	/**
	 * The constructor function for the BenchmarkSuite prototype.
	 * @param {Object} kwArgs
	 */
	function BenchmarkSuite(kwArgs) {
		this.options = {};

		for (var k in kwArgs) {
			this[k] = kwArgs[k];
		}

		this.name = this.name || this.options.name;

		var suite = this.suite = new Benchmark.Suite(this.options),
			self = this;

		// Benchmark.js has its own micro-library.  We are registering the events on this instances benchmark suite
		// in order to generate the appropriate topics for a reporter.
		suite.on('complete', function (event) {
			onComplete.call(self, event);
		});

		suite.on('cycle', function (event) {
			self.event = event;
			topic.publish('/bench/cycle', self);
		});

		suite.on('error', function (event) {
			self.error = event.target.error;
			self.event = event;

			// The Benchmark.js interface is different than the Intern's Test, so when we have a failure on error, we
			// need to create a "mock" test to pass to the reporter.
			topic.publish('/test/fail', {
				name: event.target.name,
				id: self.id + ' - ' + event.target.name,
				timeElapsed: event.target.times.elapsed,
				error: event.target.error
			});

			topic.publish('/bench/error', self);
			self.dfd.reject(self.error);
		});

		topic.publish('/bench/new', this);
	}

	BenchmarkSuite.prototype = {
		constructor: BenchmarkSuite,
		name: '',
		type: 'benchmark',
		parent: null,
		suite: null,
		options: null,
		setup: null,
		teardown: null,
		event: null,
		error: null,
		dfd: null,
		inOnComplete: false,

		/**
		 * If true, the suite will only publish its start topic after the setup callback has finished,
		 * and will publish its end topic before the teardown callback has finished.
		 */
		publishAfterSetup: false,

		get id() {
			var name = [],
				object = this;

			do {
				name.unshift(object.name);
			}
			while ((object = object.parent));

			return name.join(' - ');
		},

		/**
		 * The WebDriver interface for driving a remote environment.
		 * @see Suite#remote
		 */
		get remote() {
			return this.parent ? this.parent.remote : this._remote;
		},

		set remote(value) {
			if (this._remote) {
				throw new Error('remote may only be set once per suite');
			}

			Object.defineProperty(this, '_remote', { value: value });
		},

		/**
		 * The sessionId of the environment in which the suite executed.
		 */
		get sessionId() {
			return this.parent ? this.parent.sessionId :
				this._sessionId ? this._sessionId :
				this.remote ? this.remote.sessionId :
				null;
		},

		/**
		 * The sessionId may need to be overridden for suites proxied from client.js.
		 */
		set sessionId(value) {
			Object.defineProperty(this, '_sessionId', { value: value });
		},

		get numTests() {
			return this.suite.length;
		},

		get numFailedTests() {
			return this.suite.length - this.suite.filter('successful').length;
		},

		get hasPassed() {
			return this.suite.filter('successful').length;
		},

		/**
		 * Executes the test and returns a promise which is fulfilled when the benchmarking is complete or there is an
		 * error.
		 * @return {dojo/promise/Promise}
		 */
		run: function () {

			var self = this;

			function handleFatalError(error) {
				self.error = error;
				topic.publish('/bench/error', self);
				topic.publish('/error', error);

				if (!self.inOnComplete) {
					onComplete.call(self, { target: self.suite });
				}
			}

			if (!self.publishAfterSetup) {
				topic.publish('/bench/start', self);
			}

			self.dfd = new Deferred();
			call(self, 'setup').then(function () {
				if (self.publishAfterSetup) {
					topic.publish('/bench/start', self);
				}
				if (self.suite.length) {
					self.suite.run({ 'async': true });
				}
				else {
					// If there are no tests to run, running the benchmark suite will then not emit a `complete` event
					// which means that the test simply timeouts.
					onComplete.call(self, { target: self.suite });
				}
			}, handleFatalError);
			return self.dfd.promise;
		},

		/**
		 * Adds a test to the benchmarking suite.  `Benchmark.Suite.add()` allows mutation of the arguments, so that is
		 * preserved here, although the arity included here is recommended.
		 * @param {String} name The name of the test
		 * @param {Function} fn The function to test
		 * @param {Object?} options A hash of options to be used with the test
		 */
		addTest: function (/*name, fn, options*/) {
			this.suite.add.apply(this.suite, Array.prototype.slice.call(arguments));
		},

		/**
		 * Serialize the test into an object.
		 * @return {Object}
		 */
		toJson: function () {
			return {
				name: this.name,
				type: this.type,
				sessionId: this.sessionId,
				hasParent: !!this.parent,
				suite: String(this.suite),
				options: this.options,
				numTests: this.numTests,
				numFailedTests: this.numFailedTests,
				error: this.error ? {
					name: this.error.name,
					message: this.error.message,
					stack: this.error.stack,
					relatedTest: this.error.relatedTest
				} : null
			};
		}
	};

	return BenchmarkSuite;
});
