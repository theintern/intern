define({
	// the port on which the instrumenting proxy will listen
	proxyPort: 9000,

	// a fully qualified URL to the client.html that is passed to remotely driven browsers
	clientHtmlLocation: 'http://localhost:9000/client.html',

	// browsers to run integration testing against
	browsers: [
		{ browserName: 'internet explorer', version: [ 9, 10 ] },
		{ browserName: 'firefox', platform: [ 'LINUX', 'MAC', 'WINDOWS' ] },
		{ browserName: 'chrome', platform: [ 'LINUX', 'MAC', 'WINDOWS' ] },
		{ browserName: 'safari', platform: 'MAC', version: [ 5.1, 6 ] },
		{ browserName: 'opera', platform: [ 'LINUX', 'MAC', 'WINDOWS' ] }
	],

	// maximum number of simultaneous integration tests that can be executed on the remote WebDriver service
	maxConcurrency: 3,

	// connection information for the remote WebDriver service
	webdriver: {
		host: 'localhost',
		port: 4444
	}
});