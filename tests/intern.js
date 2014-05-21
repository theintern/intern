/* jshint dojo:true */
define({
	proxyPort: 9000,
	proxyUrl: 'http://localhost:9000/',
	maxConcurrency: 3,
	loader: {
		packages: [
			{ name: 'digdug', location: '.' },
			{ name: 'dojo', location: './node_modules/intern/node_modules/dojo' }
		]
	},
	reporters: [ 'console' ],
	suites: [ 'digdug/tests/all' ],
	functionalSuites: [],
	excludeInstrumentation: /^(?:tests|node_modules)\//
});
