/*jshint node:true */
if (typeof process !== 'undefined' && typeof define === 'undefined') {
	(function () {
		// this.require must be exposed explicitly in order to allow the loader to be
		// reconfigured from the configuration file
		var req = this.require = require('dojo/dojo');

		req({
			baseUrl: process.cwd(),
			packages: [
				{ name: 'intern', location: __dirname }
			],
			map: {
				intern: {
					dojo: 'intern/node_modules/dojo',
					chai: 'intern/node_modules/chai/chai'
				},
				'*': {
					'intern/dojo': 'intern/node_modules/dojo'
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
		'dojo/has!host-node?dojo/node!istanbul/lib/hook',
		'dojo/node!istanbul/lib/instrumenter',
		'dojo/node!sauce-connect-launcher',
		'dojo/node!path',
		'./lib/args',
		'./lib/util',
		'./lib/Suite',
		'./lib/ClientSuite',
		'./lib/wd',
		'dojo/lang',
		'dojo/topic',
		'./lib/EnvironmentType',
		'./lib/reporterManager'
	], function (
		require,
		main,
		createProxy,
		hook,
		Instrumenter,
		startConnect,
		path,
		args,
		util,
		Suite,
		ClientSuite,
		wd,
		lang,
		topic,
		EnvironmentType,
		reporterManager
	) {
		if (!args.config) {
			throw new Error('Required option "config" not specified');
		}

		main.mode = 'runner';

		this.require([ args.config ], function (config) {
			config = lang.deepCopy({
				capabilities: {
					name: args.config,
					'idle-timeout': 60
				},
				loader: {},
				maxConcurrency: 3,
				proxyPort: 9000,
				proxyUrl: 'http://localhost:9000',
				useSauceConnect: true,
				webdriver: {
					host: 'localhost',
					port: 4444
				}
			}, config);

			// Need to create a completely new config object and mix in data in order to avoid exposure of potentially
			// sensitive data (Sauce Labs username and access key) to tests
			main.config = (function () {
				var exposedConfig = lang.mixin({}, config),
					webdriver = exposedConfig.webdriver = {};

				for (var k in config.webdriver) {
					if (k === 'username' || k === 'accessKey') {
						continue;
					}
					webdriver[k] = config.webdriver[k];
				}

				return exposedConfig;
			})();

			// If the `baseUrl` passed to the loader is a relative path, it will cause `require.toUrl` to generate
			// non-absolute paths, which will break the URL remapping code in the `get` method of `lib/wd` (it will
			// slice too much data)
			if (config.loader.baseUrl) {
				config.loader.baseUrl = path.resolve(config.loader.baseUrl);
				args.config = path.relative(config.loader.baseUrl, path.resolve(args.config));
			}

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
				/*jshint maxcomplexity:13 */

				// A hash map, { reporter module ID: reporter definition }
				var reporters = [].slice.call(arguments, 0).reduce(function (map, reporter, i) {
					map[args.reporters[i]] = reporter;
					return map;
				}, {});

				reporterManager.add(reporters);

				config.proxyUrl = config.proxyUrl.replace(/\/*$/, '/');

				var basePath = (config.loader.baseUrl || process.cwd()) + '/';
				var proxy = createProxy({
					basePath: basePath,
					excludeInstrumentation: config.excludeInstrumentation,
					instrumenter: new Instrumenter({
						// coverage variable is changed primarily to avoid any jshint complaints, but also to make
						// it clearer where the global is coming from
						coverageVariable: '__internCoverage',

						// compacting code makes it harder to look at but it does not really matter
						noCompact: true,

						// auto-wrap breaks code
						noAutoWrap: true
					}),
					port: config.proxyPort
				});

				// Code in the runner should also provide instrumentation data; this is not normally necessary since
				// there shouldn’t typically be code under test running in the runner, but we do need this functionality
				// for testing leadfoot to avoid having to create the tunnel and proxy and so on ourselves
				var instrumenter = new Instrumenter({
					// coverage variable is changed primarily to avoid any jshint complaints, but also to make
					// it clearer where the global is coming from
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
						!config.excludeInstrumentation.test(filename.slice(basePath.length));
				}, function (code, filename) {
					return instrumenter.instrumentSync(code, path.resolve(filename));
				});

				// Running just the proxy and aborting is useful mostly for debugging, but also lets you get code
				// coverage reporting on the client if you want
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
						throw new Error('Missing Sauce username or access key. Disable Sauce Connect or provide ' +
							'this information.');
					}

					if (!config.capabilities['tunnel-identifier']) {
						config.capabilities['tunnel-identifier'] = '' + Date.now();
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

								// the remote needs to know the proxy URL and base filesystem path length so it can
								// munge filesystem paths passed to `get`
								remote.proxyUrl = config.proxyUrl;
								remote.proxyBasePathLength = basePath.length;
							})
							// capabilities object is not returned from `init` by at least ChromeDriver 2.25.0;
							// calling `sessionCapabilities` works every time
							.sessionCapabilities()
							.then(function (capabilities) {
								remote.environmentType = new EnvironmentType(capabilities);
								topic.publish('/session/start', remote);
							});
						},
						teardown: function () {
							function endSession() {
								topic.publish('/session/end', remote);

								if (config.webdriver.accessKey) {
									return remote.sauceJobUpdate({
										passed: suite.numFailedTests === 0 && !suite.error
									});
								}
							}

							var remote = this.remote;

							if (args.leaveRemoteOpen) {
								return endSession();
							}

							return remote.quit().always(endSession);
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
					tunnelIdentifier: config.capabilities['tunnel-identifier'],
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

						process.on('uncaughtException', function (error) {
							topic.publish('/error', error);
							process.exit(1);
						});

						topic.publish('/runner/start');
						main.run().always(function () {
							/*global __internCoverage */
							typeof __internCoverage !== 'undefined' &&
								topic.publish('/coverage', '', __internCoverage);
							topic.publish('/runner/end');
							connectProcess && connectProcess.close();
							proxy.close();
							reporterManager.clear();
						}).otherwise(function (error) {
							console.error(error.stack || error);
						});
					});
				}, function (error) {
					console.error(error.stack || error);
					proxy.close();
					process.exit(1);
				});
			});
		});
	});
}
