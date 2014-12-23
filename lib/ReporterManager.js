define([
	'dojo/has',
	'dojo/has!host-node?dojo/node!fs',
	'dojo/lang',
	'dojo/Promise'
], function (has, fs, lang, Promise) {
	// These are topics that don't directly map to reporter events
	var TOPIC_TO_EVENT = {
		'/client/end': 'runEnd',
		'/error': 'fatalError',
		'/runner/end': 'runEnd',
		'/runner/start': 'run'
	};

	// Class that wraps a legacy reporter definition in a Reporter
	function LegacyReporter(reporterMap) {
		// Add all of the topic handlers on the reporterMap  that map to Reporter events to this reporter
		var value;
		for (var topicId in reporterMap) {
			value = reporterMap[topicId];
			if (typeof value === 'function') {
				if (topicId in TOPIC_TO_EVENT) {
					topicId = TOPIC_TO_EVENT[topicId];
				}
				else {
					// Create a reporter event name from the topicId and use that as the handler name
					topicId = topicId.slice(1).replace(/\/(\w)/, function (m) { return m[1].toUpperCase(); });
				}

				// Repoter methods should return a Promise
				this[topicId] = (function (fn) {
					var promise = Promise.resolve();
					return function () {
						fn.apply(reporterMap, arguments);
						return promise;
					};
				})(value);
			}
		}
	}

	function ReporterManager() {
		this._reporters = [];
	}

	ReporterManager.prototype = {
		constructor: ReporterManager,
		_reporters: null,

		add: function (Reporter, config) {
			var reporter;
			if (typeof Reporter === 'object') {
				reporter = new LegacyReporter(Reporter);
			}
			else {
				config = Object.create(config);
				config.console = console;

				if (has('host-node')) {
					/* jshint node:true */
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
				}
			};
		},

		emit: function (name) {
			var args = Array.prototype.slice.call(arguments, 1);
			var promises = [];

			for (var i = 0, reporter; (reporter = this._reporters[i]); ++i) {
				promises.push(reporter[name] && reporter[name].apply(reporter, args));
			}

			return Promise.all(promises);
		}
	};

	return ReporterManager;
});
