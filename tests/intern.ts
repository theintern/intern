/* jshint dojo:true */
define({
	proxyPort: 9000,
	proxyUrl: 'http://localhost:9000/',
	maxConcurrency: 3,
	loaderOptions: {
		packages: [
			{ name: 'digdug', location: '.' }
		]
	},
	reporters: [ 'Console' ],
	suites: [
		'dojo/has!host-node?digdug/tests/unit/all',
		'dojo/has!host-node?digdug/tests/integration/all'
	],
	functionalSuites: [],
	excludeInstrumentation: /^(?:tests|node_modules)\//
});
