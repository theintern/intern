/*jshint node:true */
define([
	'../main',
	'./reporterManager',
	'./Suite',
	'./util',
	'require',
	'dojo/topic',
	'dojo/has',
	'dojo/has!host-node?dojo/node!path'
], function (main, reporterManager, Suite, util, require, topic, has, pathUtil) {
	main.mode = 'client';

	return {
		run: function (args, config) {
			main.config = config;

			if (!args.suites) {
				args.suites = config.suites;
			}

			if (args.grep || config.grep) {
				main.grep = (args.grep && new RegExp(args.grep)) || config.grep;
			}

			// args.suites might be an array or it might be a scalar value but we always need deps to be a fresh
			// array
			var deps = [].concat(args.suites || []);

			if (!args.reporters) {
				if (config.reporters) {
					args.reporters = config.reporters;
				}
				else {
					args.reporters = 'console';
				}
			}

			args.reporters = [].concat(args.reporters).map(function (reporterModuleId) {
				// Allow 3rd party reporters to be used simply by specifying a full mid, or built-in reporters by
				// specifying the reporter name only
				if (reporterModuleId.indexOf('/') === -1) {
					reporterModuleId = './reporters/' + reporterModuleId;
				}
				return reporterModuleId;
			});

			deps = deps.concat(args.reporters);

			// TODO: This is probably a fatal condition and so we need to let the runner know that no more
			// information will be forthcoming from this client
			if (has('host-browser')) {
				window.onerror = function (message, url, lineNumber, columnNumber, error) {
					error = error || new Error(message + ' at ' + url + ':' + lineNumber +
						(columnNumber !== undefined ? ':' + columnNumber : ''));

					if (!reportersReady) {
						console.error(error);
					}

					topic.publish('/error', error);
					topic.publish('/client/end', args.sessionId);
				};
			}
			else if (has('host-node')) {
				process.on('uncaughtException', function (error) {
					if (!reportersReady) {
						console.error(error.stack);
					}

					topic.publish('/error', error);
					process.exit(1);
				});
			}

			// Client interface has only one environment, the current environment, and cannot run functional tests
			// on itself
			main.suites.push(new Suite({ name: 'main', sessionId: args.sessionId, grep: main.grep }));

			if (has('host-node')) {
				// Hook up the instrumenter before any code dependencies are loaded
				var basePath = pathUtil.resolve(config.loader.baseUrl || process.cwd()) + '/';
				util.setInstrumentationHooks(config, basePath);
			}

			var reportersReady = false;
			require(deps, function () {
				// A hash map, { reporter module ID: reporter definition }
				var firstReporterIndex = arguments.length - args.reporters.length,
					reporters = [].slice.call(arguments, firstReporterIndex).reduce(function (map, reporter, i) {
						map[args.reporters[i]] = reporter;
						return map;
					}, {});

				reporterManager.add(reporters);
				reportersReady = true;

				if (has('host-node')) {
					var hasErrors = false;

					topic.subscribe('/error, /test/fail', function () {
						hasErrors = true;
					});

					process.on('exit', function () {
						// calling `process.exit` after the main test loop finishes will cause any remaining
						// in-progress operations to abort, which is undesirable if there are any asynchronous
						// I/O operations that a reporter wants to perform once all tests are complete; calling
						// from within the exit event avoids this problem by allowing Node.js to decide when to
						// terminate
						process.exit(hasErrors ? 1 : 0);
					});
				}

				if (args.autoRun !== 'false') {
					main.run().then(function () {
						/*global __internCoverage */
						typeof __internCoverage !== 'undefined' &&
							topic.publish('/coverage', args.sessionId, __internCoverage);
					}).always(function () {
						reporterManager.clear();
					});
				}
			});
		}
	};
});
