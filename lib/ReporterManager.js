define([
	'dojo/has',
	'dojo/has!host-node?dojo/node!fs',
	'dojo/lang',
	'dojo/Promise',
	'./util'
], function (has, fs, lang, Promise, util) {
	/**
	 * A Reporter that wraps a legacy reporter definition object.
	 */
	var LegacyReporter = (function () {
		// topics that don't directly map to reporter events
		var TOPIC_TO_EVENT = {
			'/test/new': 'newTest',
			'/suite/new': 'newSuite',
			'/client/end': 'runEnd',
			'/error': 'fatalError',
			'/runner/end': 'runEnd',
			'/runner/start': 'runStart',
			start: 'start',
			stop: 'stop'
		};

		function LegacyReporter(reporterMap) {
			var value;
			var reporterMethod;
			var promise = Promise.resolve();

			// add all of the properties on the reporterMap that look like topics or map to a known
			// reporter method (e.g., start)
			for (var topicId in reporterMap) {
				value = reporterMap[topicId];
				reporterMethod = null;

				if (typeof value === 'function') {
					if (topicId in TOPIC_TO_EVENT) {
						reporterMethod = TOPIC_TO_EVENT[topicId];
					}
					else if (topicId[0] === '/') {
						// create a reporter event name from the topicId and use that as the handler name
						reporterMethod = topicId.slice(1).replace(/\/(\w)/, function (m) {
							return m[1].toUpperCase();
						});
					}

					if (reporterMethod) {
						// reporter methods should return a Promise
						this[reporterMethod] = (function (fn) {
							return function () {
								fn.apply(reporterMap, arguments);
								return promise;
							};
						})(value);
					}
				}
			}
		}

		return LegacyReporter;
	})();

	/**
	 * A class that manages a set of reporters
	 *
	 * Standard events:
	 *     coverage
	 *     fatalError
	 *     newSuite
	 *     newTest
	 *     proxyEnd
	 *     proxyStart
	 *     runEnd
	 *     runStart
	 *     start
	 *     stop
	 *     suiteEnd
	 *     suiteError
	 *     suiteStart
	 *     testEnd
	 *     testPass
	 *     testSkip
	 *     testStart
	 *     tunnelDownloadProgress
	 *     tunnelEnd
	 *     tunnelStart
	 *     tunnelStatus
	 */
	function ReporterManager() {
		this._reporters = [];
	}

	ReporterManager.prototype = {
		constructor: ReporterManager,
		_reporters: null,

		/**
		 * Add a reporter to the list of managed reporters.
		 *
		 * @param {string} name event name to emit
		 */
		add: function (Reporter, config) {
			var reporter;

			if (typeof Reporter === 'object') {
				reporter = new LegacyReporter(Reporter);
			}
			else {
				config = Object.create(config);
				config.console = console;

				if (has('host-node')) {
					// jshint node:true
					if (config.filename) {
						config.output = fs.createWriteStream(config.filename);
					}
					else {
						config.output = process.stdout;
					}
				}
				else if (has('host-browser')) {
					var element = document.createElement('pre');
					document.body.appendChild(element);
					config.output = {
						write: function (chunk, encoding, callback) {
							element.appendChild(document.createTextNode(chunk));
							callback();
						},
						end: function (chunk, encoding, callback) {
							element.appendChild(document.createTextNode(chunk));
							callback();
						}
					};
				}

				reporter = new Reporter(config);
			}

			var reporters = this._reporters;
			reporters.push(reporter);

			return {
				remove: function () {
					this.remove = function () {};
					lang.pullFromArray(reporters, reporter);
					return reporter.stop && reporter.stop();
				}
			};
		},

		/**
		 * Emit an event to all registered reporters that can respond to it.
		 *
		 * @param {string} name event name to emit
		 */
		emit: function (name) {
			var nameAndArgs = Array.prototype.slice.call(arguments, 0);
			var onlyArgs = nameAndArgs.slice(1);
			return Promise.all(this._reporters.map(function (reporter) {
				var args;
				var handler;

				// if a reporter a handler for an event name, call the handler, otherwise if the reporter has
				// a catchall handler, call that
				if (reporter[name]) {
					handler = reporter[name];
					args = onlyArgs;
				}
				else if (reporter.catchall) {
					handler = reporter.catchall;
					args = nameAndArgs;
				}

				if (handler) {
					var promise = handler.apply(reporter, args);

					// if we're reporting a fatalError, flat the error as reported to prevent
					// duplicate reports
					if (name === 'fatalError') {
						args[0].reported = true;
					}

					return promise;
				}
			})).catch(function (error) {
				// if there was an error calling a reporter, log it to the console
				console.error(util.getErrorMessage(error));
				throw error;
			});
		}
	};

	return ReporterManager;
});
