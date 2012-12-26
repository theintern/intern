define({
	// the port on which the instrumenting proxy will listen
	proxyPort: 9000,

	// a fully qualified URL to the client.html that is passed to remotely driven browsers for unit testing
	clientHtmlLocation: 'http://localhost:9000/client.html',

	// browsers to run integration testing against. Note that version numbers must be strings if used with Sauce
	// OnDemand. Available options are browserName, browserVersion, platformName, and platformVersion
	browsers: [
		{ browserName: 'internet explorer', browserVersion: [ '9', '10' ] },
		{ browserName: 'firefox', platformName: [ 'LINUX', 'MAC', 'WINDOWS' ] },
		{ browserName: 'chrome', platformName: [ 'LINUX', 'MAC', 'WINDOWS' ] },
		{ browserName: 'safari', platformName: 'MAC', browserVersion: [ '5.1', '6' ] },
		{ browserName: 'opera', platformName: [ 'LINUX', 'MAC', 'WINDOWS' ] }
	],

	// maximum number of simultaneous integration tests that can be executed on the remote WebDriver service
	maxConcurrency: 3,

	// whether or not to start Sauce Connect before running tests
	useSauceConnect: true,

	// connection information for the remote WebDriver service. If using Sauce Labs, keep your username and password
	// in the SAUCE_USERNAME and SAUCE_ACCESS_KEY environment variables unless you are sure you will NEVER be
	// publishing this configuration file somewhere
	webdriver: {
		host: 'localhost',
		port: 4444
	}
});