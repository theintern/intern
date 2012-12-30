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
		'require',
		'./lib/createProxy',
		'./lib/runBrowser',
		'dojo-ts/node!istanbul/lib/instrumenter',
		'dojo-ts/node!sauce-connect-launcher',
		'./lib/args',
		'./lib/util',
		'dojo-ts/topic',
		'dojo-ts/Deferred',
		'dojo-ts/io-query'
	], function (require, createProxy, startBrowser, Instrumenter, startConnect, args, util, topic, Deferred, ioQuery) {
		if (!args.config) {
			throw new Error('Required option "config" not specified');
		}

		if (!args.reporter) {
			console.info('Defaulting to "runner" reporter');
			args.reporter = 'runner';
		}

		args.reporter = args.reporter.indexOf('/') > -1 ? args.reporter : './lib/reporters/' + args.reporter;

		require([ args.config, args.reporter ], function (config) {
			function testBrowsers() {
				var numBrowsersTested = 0,
					numBrowsersToTest = browsersToTest.length,
					hasErrors = false;

				topic.subscribe('/error, /test/fail', function () {
					hasErrors = true;
				});

				topic.publish('/runner/start');
				browsersToTest.forEach(queue(function (browserType) {
					function finish(error) {
						if (browser) {
							browser.quit().always(function () {
								topic.publish('/session/end', browser);
								browser = null;
								finish(error);
							});
							return;
						}

						if (error) {
							topic.publish('/error', error);
							dfd.reject(error);
						}
						else {
							dfd.resolve();
						}

						if (++numBrowsersTested === numBrowsersToTest) {
							topic.publish('/runner/end');

							// TODO: This makes /runner/end incapable of performing async actions; is this a problem?
							process.exit(hasErrors ? 1 : 0);
						}
					}

					var dfd = new Deferred(),
						browser;

					// TODO: Rename runBrowser.js to startBrowser.js
					startBrowser(browserType, config).then(function loadAutomatedSuite(/*browser*/) {
						browser = arguments[0];
						topic.publish('/session/start', browser);

						// do automated tests
						var options = {
							sessionId: browser.sessionId,
							reporter: 'webdriver',
							suites: config.suites
						};

						if (config.packages) {
							options.packages = JSON.stringify(config.packages);
						}

						return browser.get(config.clientHtmlLocation + '?' + ioQuery.objectToQuery(options));
					}).then(function waitForSuiteToFinish() {
						var dfd = new Deferred(),

							// TODO: Use a more appropriate finalizer topic?
							handle = topic.subscribe('/client/end', function (sessionId) {
								if (sessionId === browser.sessionId) {
									handle.remove();
									dfd.resolve();
								}
							});

						// TODO: And if the final message never comes due to an error or timeout..?

						return dfd.promise;
					}).then(function runFunctionalTests() {
						// TODO: Functional tests
					}).always(finish);

					return dfd;
				}));
			}

			var queue = util.createQueue(config.maxConcurrency),
				browsersToTest = util.flattenBrowsers(config.browsers);

			createProxy(config.proxyPort, new Instrumenter({
				// coverage variable is changed primarily to avoid any jshint complaints, but also to make it clearer
				// where the global is coming from
				coverageVariable: '__teststackCoverage',

				// compacting code makes it harder to look at but it does not really matter
				noCompact: true,

				// auto-wrap breaks code
				noAutoWrap: true
			}), '..');

			if (args.proxyOnly) {
				return;
			}

			if (process.env.SAUCE_USERNAME) {
				config.webdriver.username = process.env.SAUCE_USERNAME;
			}
			if (process.env.SAUCE_ACCESS_KEY) {
				config.webdriver.accessKey = process.env.SAUCE_ACCESS_KEY;
			}

			// TODO: Global require is needed because context require does not currently have config mechanics built
			// in.
			config.packages && this.require({ packages: config.packages });

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
			}).then(testBrowsers, function (error) {
				console.error(error);
				process.exit(1);
			});
		});
	});
}