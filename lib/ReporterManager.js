define([
	'dojo/has',
	'dojo/has!host-node?fs',
	'dojo/lang',
	'dojo/Promise'
], function (has, fs, lang, Promise) {
	function ReporterManager() {
		this._reporters = [];
	}

	ReporterManager.prototype = {
		constructor: ReporterManager,
		_reporters: null,

		add: function (Reporter, config) {
			// TODO: If Reporter is not a constructor then treat it like a legacy reporter

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

			var reporters = this._reporters;
			var reporter = new Reporter(config);
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
});
