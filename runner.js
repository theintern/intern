/*jshint node:true */
if (typeof process !== 'undefined' && typeof define === 'undefined') {
	var req = require('./dojo/dojo');
	req({
		baseUrl: __dirname + '/',
		packages: [ 'dojo', 'istanbul', 'wd', { name: 'teststack', location: '.' } ]
	}, [ 'teststack/runner' ]);
}
else {
	define([
		'./lib/createInstrumentationServer',
		'./lib/createBrowserPermutations',
		'dojo/node!istanbul/lib/instrumenter',
		'dojo/promise/all',
		'./lib/args',
		'./lib/wd',
		'./config'
	], function (createInstrumentationServer, createBrowserPermutations, Instrumenter, whenAll, args, wd, config) {
		var _cleaningUp = false;
		function cleanup() {
			if (_cleaningUp) {
				return;
			}

			_cleaningUp = true;
			console.log('Cleaning up');

			var session,
				cleanups = [];
			while ((session = sessions.pop())) {
				cleanups.push(session.quit());
			}

			server && server.close();

			whenAll(cleanups, function () {
				console.log('All done!');
				process.exit(0);
			});
		}

		if (!args.config) {
			throw new Error('Required option "config" not specified');
		}

		var instrumenter = new Instrumenter({ coverageVariable: '__teststackCoverage', noCompact: true, noAutoWrap: true });
		var server = createInstrumentationServer(config.proxyPort, instrumenter, '.');

		var sessions = [];

		require([ args.config ], function (testConfig) {
			createBrowserPermutations(config.browsers).slice(3, 4).forEach(function (browserType) {
				console.log('Remoting');
				var browser = wd.remote(config.webdriver);
				sessions.push(browser);
				console.log('Creating', browserType.browserName, browserType.version, browserType.platform);
				browser
					.init(browserType)
					.then(function loadClient(sessionId) {
						console.log('Session', sessionId, 'started');
						return browser.get(config.clientHtmlLocation + '?reporter=webdriver&suites=' + testConfig.suites);
					})
					.then(function setAsyncTimeout() {
						return browser.setAsyncScriptTimeout(/* 10 minutes */ 10 * 60 * 1000);
					})
					.then(function registerConduit() {
						return browser.executeAsync('this.remoteTestCallback = arguments[0];');
					})
					.then(function reportResults(results) {
						console.log(results);
						cleanup();
					})
					.otherwise(function reportError(error) {
						console.error(error);
						cleanup();
					});
			});
		});

		process.on('SIGINT', cleanup);
		process.on('uncaughtException', cleanup);
	});
}