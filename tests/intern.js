define({
	proxyPort: 9000,
	proxyUrl: 'http://localhost:9000/',

	capabilities: {
		'selenium-version': '2.41.0',
		'idle-timeout': 30
	},

	environments: [
// TODO: Sauce Labs IE environments (and Android environments, and iOS environments) are B-R-O-K-E-N. Wait for Intern 2
// and then switch providers!
//		{ browserName: 'internet explorer', version: '11', platform: 'Windows 8.1' },
//		{ browserName: 'internet explorer', version: '10', platform: 'Windows 8' },
//		{ browserName: 'internet explorer', version: '9', platform: 'Windows 7' },
		{ browserName: 'firefox', version: '30', platform: [ 'Windows 7', 'Linux' ] },
		{ browserName: 'firefox', version: '29', platform: 'OS X 10.9' },
		{ browserName: 'chrome', version: '35', platform: [ 'OS X 10.9', 'Windows 7', 'Linux' ] },
		{ browserName: 'safari', version: '7', platform: 'OS X 10.9' }
	],

	maxConcurrency: 3,

	useSauceConnect: true,

	webdriver: {
		hostname: 'localhost',
		port: 4444
	},

	loader: {
		packages: [
			{ name: 'leadfoot', location: '.' },
			{ name: 'dojo', location: './node_modules/dojo' }
		]
	},

	suites: [
		'dojo/has!host-node?leadfoot/tests/unit/lib/util',
		'dojo/has!host-node?leadfoot/tests/unit/compat'
	],

	functionalSuites: [
		'leadfoot/tests/functional/helpers/pollUntil',
		'leadfoot/tests/functional/Server',
		'leadfoot/tests/functional/Session',
		'leadfoot/tests/functional/Element',
		'leadfoot/tests/functional/Command',
		'leadfoot/tests/functional/compat'
	],

	excludeInstrumentation: /^(?:tests|node_modules)\//
});
