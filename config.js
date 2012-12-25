define({
	// the port on which the instrumenting proxy will listen
	proxyPort: 9000,

	// a fully qualified URL to the client.html that is passed to remotely driven browsers
	clientHtmlLocation: 'http://localhost:9000/client.html',

	// browsers to run integration testing against
	browsers: [
		{ browserName: 'internet explorer', browserVersion: [ 9, 10 ] },
		{ browserName: 'firefox', platformName: [ 'LINUX', 'MAC', 'WINDOWS' ] },
		{ browserName: 'chrome', platformName: [ 'LINUX', 'MAC', 'WINDOWS' ] },
		{ browserName: 'safari', platformName: 'MAC', browserVersion: [ 5.1, 6 ] },
		{ browserName: 'opera', platformName: [ 'LINUX', 'MAC', 'WINDOWS' ] }
	],

	// maximum number of simultaneous integration tests that can be executed on the remote WebDriver service
	maxConcurrency: 2,

	// connection information for the remote WebDriver service
	webdriver: {
		host: 'localhost',
		port: 4444
	}
});