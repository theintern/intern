/*jshint node:true */
define([
	'../main',
	'./reporterManager',
	'./Suite',
	'./util',
	'require',
	'dojo/topic',
	'dojo/has',
	'dojo/has!host-node?dojo/node!istanbul/lib/hook',
	'dojo/has!host-node?dojo/node!istanbul/lib/instrumenter',
	'dojo/has!host-node?dojo/node!path',
	'dojo/has!host-node?./thresholdCheck'
], function (main, reporterManager, Suite, util, require, topic, has, hook, Instrumenter, path, coverageThresholdCheck) {
	return {
		run: function (args, config) {
			main.config = config;

			if (!args.suites) {
				args.suites = config.suites;
			}

			// args.suites might be an array or it might be a scalar value but we always need deps to be a fresh
			// array
			var deps = [].concat(args.suites || []);

			if (!args.reporters) {
				if (config.reporters) {
					args.reporters = config.reporters;
				}
				else {
					console.info('Defaulting to "console" reporter');
					args.reporters = 'console';
				}
			}
			args.reporters = [].concat(args.reporters).map(util.normalizeReporterId('./reporters/'));

			deps = deps.concat(args.reporters.map(function(reporter) { return reporter.id;}));

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
			main.suites.push(new Suite({ name: 'main', sessionId: args.sessionId }));

			if (has('host-node')) {
				// Hook up the instrumenter before any code dependencies are loaded
				var basePath = path.resolve(config.loader.baseUrl || process.cwd()) + '/',
					instrumentor = new Instrumenter({
						// coverage variable is changed primarily to avoid any jshint complaints, but also to make
						// it clearer where the global is coming from
						coverageVariable: '__internCoverage',

						// compacting code makes it harder to look at but it does not really matter
						noCompact: true,

						// auto-wrap breaks code
						noAutoWrap: true
					});

				coverageThresholdCheck(topic, config.coverageThresholds);

				hook.hookRunInThisContext(function (filename) {
					return !config.excludeInstrumentation ||
						// if the string passed to `excludeInstrumentation` changes here, it must also change in
						// `lib/createProxy.js`
						!config.excludeInstrumentation.test(filename.slice(basePath.length));
				}, function (code, filename) {
					return instrumentor.instrumentSync(code, path.resolve(filename));
				});
			}

			var reportersReady = false;
			require(deps, function () {
				// A hash map, { reporter module ID: reporter definition }
				var firstReporterIndex = arguments.length - args.reporters.length,
					reporters = [].slice.call(arguments, firstReporterIndex).reduce(util.normalizeReporterConfig(args.reporters), {});

				reporterManager.add(reporters);
				reportersReady = true;

				if (has('host-node')) {
					var hasErrors = false;

					topic.subscribe('/error, /test/fail, /coverage/error', function () {
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
