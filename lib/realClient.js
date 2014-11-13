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
			/*jshint maxcomplexity:14 */
			main.config = config;

			if (args.grep || config.grep) {
				main.grep = (args.grep && new RegExp(args.grep)) || config.grep;
			}

			if (args.suites === undefined) {
				args.suites = config.suites;
			}

			// Ensure args.suites is an array
			args.suites = [].concat(args.suites || []);

			if (!args.reporters) {
				if (config.reporters) {
					args.reporters = config.reporters;
				}
				else {
					args.reporters = [ 'console' ];
					if (has('host-browser')) {
						args.reporters.push('html');
					}
				}
			}

			// Ensure args.reporters is an array of module IDs
			args.reporters = [].concat(args.reporters).map(function (reporterModuleId) {
				// Allow 3rd party reporters to be used simply by specifying a full mid, or built-in reporters by
				// specifying the reporter name only
				if (reporterModuleId.indexOf('/') === -1) {
					reporterModuleId = './reporters/' + reporterModuleId;
				}
				return reporterModuleId;
			});

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
				(function () {
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
				})();

				process.on('uncaughtException', function (error) {
					if (!reportersReady) {
						console.error(error.stack);
					}

					topic.publish('/error', error);
					topic.publish('/client/end');
					process.exit();
				});
			}

			// Client interface has only one environment, the current environment, and cannot run functional tests
			// on itself
			main.suites.push(new Suite({ name: 'main', sessionId: args.sessionId, grep: main.grep }));

			if (has('host-node')) {
				// Hook up the instrumenter before any code dependencies are loaded
				// passing `process.cwd()` to `pathUtil.resolve` since it will throw an error if `undefined` is passed
				// (like when `baseUrl` is not explicitly set) but is a no-op for an already-absolute path
				var basePath = pathUtil.join(pathUtil.resolve(config.loader.baseUrl || process.cwd()), '/');
				util.setInstrumentationHooks(config, basePath);
			}

			var reportersReady = false;
			require(args.reporters, function () {
				// A hash map, { reporter module ID: reporter definition }
				var reporters = [].slice.call(arguments, 0).reduce(function (map, reporter, i) {
					map[args.reporters[i]] = reporter;
					return map;
				}, {});

				reporterManager.add(reporters);
				reportersReady = true;

				require(args.suites, function () {
					if (args.autoRun !== 'false') {
						main.run().then(function () {
							topic.publish('/client/end');
							/*global __internCoverage */
							typeof __internCoverage !== 'undefined' &&
								topic.publish('/coverage', args.sessionId, __internCoverage);
						}).always(function () {
							reporterManager.clear();
						});
					}
				});
			});
		}
	};
});
