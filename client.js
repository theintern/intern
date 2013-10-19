/*jshint node:true */
/*global __internCoverage */
if (typeof process !== 'undefined' && typeof define === 'undefined') {
	(function () {
		var req = require('dojo/dojo'),
			pathUtils = require('path'),
			basePath = pathUtils.dirname(process.argv[1]);

		req({
			baseUrl: pathUtils.resolve(basePath, '..', '..'),
			packages: [
				{ name: 'intern', location: basePath }
			],
			map: {
				intern: {
					dojo: 'intern/node_modules/dojo',
					chai: 'intern/node_modules/chai/chai',
					benchmark: 'intern/node_modules/benchmark/benchmark'
				}
			}
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
		'require',
		'dojo/has!host-node?dojo/node!istanbul/lib/hook',
		'dojo/has!host-node?dojo/node!istanbul/lib/instrumenter'
	], function (main, args, reporterManager, Suite, topic, has, require, hook, Instrumenter) {
		if (!args.config) {
			throw new Error('Missing "config" argument');
		}

		require([ args.config ], function (config) {
			// TODO: Use of the global require is required for this to work because config mechanics are in global
			// require only in the Dojo loader; this should probably not be the case
			var globalRequire = this.require;
			globalRequire(config.loader);

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

			if (has('host-node')) {
				// Hook up the instrumenter before any code dependencies are loaded
				var instrumentor = new Instrumenter({
					// coverage variable is changed primarily to avoid any jshint complaints, but also to make it
					// clearer where the global is coming from
					coverageVariable: '__internCoverage',

					// compacting code makes it harder to look at but it does not really matter
					noCompact: true,

					// auto-wrap breaks code
					noAutoWrap: true
				});

				hook.hookRunInThisContext(function (filename) {
					return !config.excludeInstrumentation ||
						// if the string passed to `excludeInstrumentation` changes here, it must also change in
						// `lib/createProxy.js`
						!config.excludeInstrumentation.test(filename.slice(globalRequire.baseUrl.length));
				}, function (code, filename) {
					return instrumentor.instrumentSync(code, filename);
				});
			}

			var reportersReady = false;
			require(deps, function () {
				// A hash map, { reporter module ID: reporter definition }
				var reporters = [].slice.call(arguments, arguments.length - args.reporters.length).reduce(function (map, reporter, i) {
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
						typeof __internCoverage !== 'undefined' &&
							topic.publish('/coverage', args.sessionId, __internCoverage);
					});
				}
			});
		});
	});
}
