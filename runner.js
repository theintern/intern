/*jshint node:true */
if (typeof process !== 'undefined' && typeof define === 'undefined') {
	var req = require('./dojo/dojo');
	req({
		baseUrl: __dirname + '/../',
		packages: [
			{ name: 'dojo-ts', location: __dirname + '/dojo' },
			{ name: 'teststack', location: __dirname }
		]
	}, [ 'teststack/runner' ]);
}
else {
	define([
		'./lib/createProxy',
		'./lib/runBrowser',
		'dojo/node!istanbul/lib/instrumenter',
		'dojo/node!istanbul/lib/collector',
		'dojo/node!istanbul/lib/report/text-summary',
		'dojo-ts/node!sauce-connect-launcher',
		'./lib/args',
		'./lib/util'
	], function (createProxy, runBrowser, Instrumenter, Collector, Reporter, startConnect, args, util) {
		if (!args.config) {
			throw new Error('Required option "config" not specified');
		}

		require([ args.config ], function (config) {
			function testBrowsers() {
				browsersToTest.forEach(queue(function (browserType) {
					return runBrowser(browserType, config).always(function (result) {
						console.log('(%d/%d) %s done', numCompletedTests + 1, numTests, browserType);
						runs[browserType] = result;
						if (++numCompletedTests === numTests) {
							finish();
						}
					});
				}));
			}

			function finish() {
				console.log('All done!');

				var collector = new Collector(),
					reporter = new Reporter(),
					numRuns = 0,
					numTests = 0,
					numFailedTests = 0;

				for (var k in runs) {
					var run = runs[k];

					if (run && run.result) {
						var runCollector = new Collector();
						++numRuns;
						runCollector.add(run.result.coverage);
						collector.add(run.result.coverage);
						numTests += run.result.suite.numTests;
						numFailedTests += run.result.suite.numFailedTests;

						console.log('%s: %d/%d tests failed', k, run.result.suite.numFailedTests, run.result.suite.numTests);
						reporter.writeReport(runCollector);

						runCollector = null;
					}
					else {
						numTests += 1;
						numFailedTests += 1;
						console.log('%s: execution failed: %s', k, run.stack);
					}
				}

				console.log('\n\nTOTAL: tested %d platforms, %d/%d tests failed', numRuns, numFailedTests, numTests);

				try {
					reporter.writeReport(collector);
				}
				catch (error) {
					console.error(error);
				}

				server.close();

				process.exit(numFailedTests > 0 ? 1 : 0);
			}

			var runs = {},
				queue = util.createQueue(config.maxConcurrency),
				browsersToTest = util.flattenBrowsers(config.browsers),
				numTests = browsersToTest.length,
				numCompletedTests = 0,
				server = createProxy(config.proxyPort, new Instrumenter({
					// coverage variable is changed primarily to avoid any jshint complaints, but also to make it clearer
					// where the global is coming from
					coverageVariable: '__teststackCoverage',

					// compacting code makes it harder to look at but it does not really matter
					noCompact: true,

					// auto-wrap breaks code
					noAutoWrap: true
				}), '.');

			if (process.env.SAUCE_USERNAME) {
				config.webdriver.username = process.env.SAUCE_USERNAME;
			}
			if (process.env.SAUCE_ACCESS_KEY) {
				config.webdriver.accessKey = process.env.SAUCE_ACCESS_KEY;
			}

			config.packages && require({ packages: config.packages });

			var startup;
			if (config.useSauceConnect) {
				if (!config.webdriver.username || !config.webdriver.accessKey) {
					throw new Error('Missing Sauce username or access key. Disable Sauce Connect or provide this information.');
				}

				startup = util.adapt(startConnect);
			}
			else {
				startup = function () {
					return {
						then: function (callback) {
							callback();
						}
					};
				};
			}

			startup({
				logger: function () {
					console.log.apply(console, arguments);
				},
				username: config.webdriver.username,
				accessKey: config.webdriver.accessKey,
				port: config.webdriver.port
			}).then(testBrowsers, function (error) { console.error(error); process.exit(1); });
		});
	});
}