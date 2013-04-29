/*jshint node:true */
if (typeof process !== 'undefined' && typeof define === 'undefined') {
	(function () {
		var req = require('./dojo/dojo'),
			pathUtils = require('path');

		req({
			baseUrl: pathUtils.resolve(__dirname, '..'),
			packages: [
				{ name: 'intern', location: __dirname },
				{ name: 'chai', location: pathUtils.resolve(__dirname, 'chai'), main: 'chai' }
			],
			map: { intern: { dojo: pathUtils.resolve(__dirname, 'dojo') } }
		}, [ 'intern/client' ]);
	})();
}
else {
	define([
		'./main',
		'./lib/args',
		'./lib/reporterManager',
		'./lib/Suite',
		'dojo/topic',
		'dojo/has',
		'require'
	], function (main, args, reporterManager, Suite, topic, has, require) {
		if (!args.config) {
			throw new Error('Missing "config" argument');
		}

		require([ args.config ], function (config) {
			// TODO: Use of the global require is required for this to work because config mechanics are in global
			// require only in the Dojo loader; this should probably not be the case
			this.require(config.loader);

			if (!args.suites) {
				args.suites = config.suites;
			}

			// args.suites might be an array or it might be a scalar value but we always need deps to be a fresh array.
			var deps = [].concat(args.suites);

			if (!args.reporters) {
				if (config.reporters) {
					args.reporters = config.reporters;
				}
				else {
					console.info('Defaulting to "console" reporter');
					args.reporters = 'console';
				}
			}

			// TODO: This is probably a fatal condition and so we need to let the runner know that no more information
			// will be forthcoming from this client
			if (typeof window !== 'undefined') {
				window.onerror = function (message, url, lineNumber) {
					var error = new Error(message + ' at ' + url + ':' + lineNumber);
					topic.publish('/error', error);
					topic.publish('/client/end', args.sessionId);
				};
			}
			else if (typeof process !== 'undefined') {
				process.on('uncaughtException', function (error) {
					topic.publish('/error', error);
				});
			}

			args.reporters = [].concat(args.reporters).map(function (reporterModuleId) {
				// Allow 3rd party reporters to be used simply by specifying a full mid, or built-in reporters by
				// specifying the reporter name only
				if (reporterModuleId.indexOf('/') === -1) {
					reporterModuleId = './lib/reporters/' + reporterModuleId;
				}
				return reporterModuleId;
			});

			deps = deps.concat(args.reporters);

			// Client interface has only one environment, the current environment, and cannot run functional tests on
			// itself
			main.suites.push(new Suite({ name: 'main', sessionId: args.sessionId }));

			require(deps, function () {
				// A hash map, { reporter module ID: reporter definition }
				var reporters = [].slice.call(arguments, arguments.length - args.reporters.length).reduce(function (map, reporter, i) {
					map[args.reporters[i]] = reporter;
					return map;
				}, {});

				reporterManager.add(reporters);

				if (args.autoRun !== 'false') {
					if (has('host-node')) {
						var hasErrors = false;

						topic.subscribe('/error, /test/fail', function () {
							hasErrors = true;
						});

						main.run().always(function () {
							process.exit(hasErrors ? 1 : 0);
						});
					}
					else {
						main.run();
					}
				}
			});
		});
	});
}