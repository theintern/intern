/*jshint node:true */
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
					chai: 'intern/node_modules/chai/chai'
				}
			}
		}, [ 'intern/runner' ]);
	})();
}
else {
	define([
		'require',
		'./main',
		'./lib/createProxy',
		'dojo/node!istanbul/lib/instrumenter',
		'dojo/node!sauce-connect-launcher',
		'./lib/args',
		'./lib/util',
		'./lib/Suite',
		'./lib/ClientSuite',
		'./lib/wd',
		'dojo/lang',
		'dojo/topic',
		'./lib/EnvironmentType',
		'./lib/reporterManager'
	], function (require, main, createProxy, Instrumenter, startConnect, args, util, Suite, ClientSuite, wd, lang, topic, EnvironmentType, reporterManager) {
		if (!args.config) {
			throw new Error('Required option "config" not specified');
		}

		require([ args.config ], function (config) {
			config = lang.deepCopy({
				capabilities: {
					'idle-timeout': 60,
					name: args.config
				},
				maxConcurrency: 3,
				proxyPort: 9000,
				proxyUrl: 'http://localhost:9000',
				useSauceConnect: true,
				webdriver: {
					host: 'localhost',
					port: 4444
				}
			}, config);

			// TODO: Global require is needed because context require does not currently have config mechanics built
			// in.
			this.require(config.loader);

			if (!args.reporters) {
				if (config.reporters) {
					args.reporters = config.reporters;
				}
				else {
					console.info('Defaulting to "runner" reporter');
					args.reporters = 'runner';
				}
			}

			args.reporters = [].concat(args.reporters).map(function (reporterModuleId) {
				// Allow 3rd party reporters to be used simply by specifying a full mid, or built-in reporters by
				// specifying the reporter name only
				if (reporterModuleId.indexOf('/') === -1) {
					reporterModuleId = './lib/reporters/' + reporterModuleId;
				}
				return reporterModuleId;
			});

			require(args.reporters, function () {
				// A hash map, { reporter module ID: reporter definition }
				var reporters = [].slice.call(arguments, 0).reduce(function (map, reporter, i) {
					map[args.reporters[i]] = reporter;
					return map;
				}, {});

				reporterManager.add(reporters);

				config.proxyUrl = config.proxyUrl.replace(/\/*$/, '/');

				var proxy = createProxy({
					basePath: this.require.baseUrl,
					excludeInstrumentation: config.excludeInstrumentation,
					instrumenter: new Instrumenter({
						// coverage variable is changed primarily to avoid any jshint complaints, but also to make it clearer
						// where the global is coming from
						coverageVariable: '__internCoverage',

						// compacting code makes it harder to look at but it does not really matter
						noCompact: true,

						// auto-wrap breaks code
						noAutoWrap: true
					}),
					port: config.proxyPort
				});

				// Running just the proxy and aborting is useful mostly for debugging, but also lets you get code coverage
				// reporting on the client if you want
				if (args.proxyOnly) {
					return;
				}

				// TODO: Verify that upon using delete, it is not possible for the program to retrieve these environment
				// variables another way.
				if (process.env.SAUCE_USERNAME) {
					config.webdriver.username = process.env.SAUCE_USERNAME;
					if (!(delete process.env.SAUCE_USERNAME)) {
						throw new Error('Failed to clear sensitive environment variable SAUCE_USERNAME');
					}
				}
				if (process.env.SAUCE_ACCESS_KEY) {
					config.webdriver.accessKey = process.env.SAUCE_ACCESS_KEY;
					if (!(delete process.env.SAUCE_ACCESS_KEY)) {
						throw new Error('Failed to clear sensitive environment variable SAUCE_ACCESS_KEY');
					}
				}

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

				main.maxConcurrency = config.maxConcurrency || Infinity;

				if (process.env.TRAVIS_COMMIT) {
					config.capabilities.build = process.env.TRAVIS_COMMIT;
				}

				util.flattenEnvironments(config.capabilities, config.environments).forEach(function (environmentType) {
					var suite = new Suite({
						name: 'main',
						remote: wd.remote(config.webdriver, environmentType),
						publishAfterSetup: true,
						setup: function () {
							var remote = this.remote;
							return remote.init()
							.then(function getEnvironmentInfo(/* [ sessionId, capabilities? ] */ environmentInfo) {
								// wd incorrectly puts the session ID on a `sessionID` property, which violates
								// JavaScript style convention
								remote.sessionId = environmentInfo[0];

								// the remote needs to know the proxy URL so it can munge filesystem paths passed to
								// `get`
								remote.proxyUrl = config.proxyUrl;
							})
							// capabilities object is not returned from `init` by at least ChromeDriver 0.25.0;
							// calling `sessionCapabilities` works every time
							.sessionCapabilities()
							.then(function (capabilities) {
								remote.environmentType = new EnvironmentType(capabilities);
								topic.publish('/session/start', remote);
							});
						},

						teardown: function () {
							var remote = this.remote;
							return remote.quit().always(function () {
								topic.publish('/session/end', remote);
							});
						}
					});

					suite.tests.push(new ClientSuite({ parent: suite, config: config }));
					main.suites.push(suite);
				});

				startup({
					/*jshint camelcase:false */
					logger: function () {
						console.log.apply(console, arguments);
					},
					username: config.webdriver.username,
					accessKey: config.webdriver.accessKey,
					port: config.webdriver.port,
					no_progress: !process.stdout.isTTY
				}).then(function (connectProcess) {
					require(config.functionalSuites || [], function () {
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

						topic.publish('/runner/start');
						main.run().always(function () {
							topic.publish('/runner/end');
							connectProcess && connectProcess.close();
							proxy.close();
						});
					});
				}, function (error) {
					console.error(error);
					proxy.close();
				});
			});
		});
	});
}
