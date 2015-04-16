define([
	'dojo/has',
	'dojo/has!host-node?dojo/node!fs',
	'dojo/lang',
	'dojo/aspect',
	'dojo/Promise',
	'./util'
], function (has, fs, lang, aspect, Promise, util) {
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
			'/tunnel/stop': 'tunnelEnd',
			start: 'run',
			stop: 'destroy'
		};

		/**
		 * Converts a legacy Intern 2 reporter to an Intern 3 reporter instance.
		 */
		function LegacyReporter(reporterMap) {
			var callback;
			var eventName;

			// add all of the properties on the reporterMap that look like topics or map to a known
			// reporter method (e.g., start)
			for (var topicId in reporterMap) {
				callback = reporterMap[topicId];
				eventName = null;

				if (topicId in TOPIC_TO_EVENT) {
					eventName = TOPIC_TO_EVENT[topicId];
				}
				// programmatically transform legacy topic ID to event name
				else if (topicId.charAt(0) === '/') {
					eventName = topicId.slice(1).replace(/\/(\w)/g, function (_, firstLetter) {
						return firstLetter.toUpperCase();
					});
				}
				else {
					continue;
				}

				aspect.before(this, eventName, (function (callback) {
					return function () {
						return callback.apply(reporterMap, arguments);
					};
				})(callback));
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
					return reporter.destroy && reporter.destroy();
				}
			};
		},

		empty: function () {
			this._reporters.forEach(function (reporter) {
				reporter.destroy && reporter.destroy();
			});
			this._reporters = [];
		},

		/**
		 * Emit an event to all registered reporters that can respond to it.
		 *
		 * @param {string} name event name to emit
		 */
		emit: function (name) {
			var args = Array.prototype.slice.call(arguments, 1);
			return Promise.all(this._reporters.map(function (reporter) {
				if (reporter[name]) {
					// In the case that a fatal error occurs and there are no reporters around that care,
					// the pre-executor will make a hail mary pass to try to get the information out by sending it to
					// the early error reporter if the error does not have a `reported` property
					if (name === 'fatalError' && args[0]) {
						args[0].reported = true;
					}

					return reporter[name].apply(reporter, args);
				}
			}));
		}
	};

	return ReporterManager;
});
