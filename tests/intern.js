define({
	capabilities: {
		'selenium-version': '2.43.0',
		'idle-timeout': 30
	},

	environments: [
		{ browserName: 'internet explorer', version: '11', platform: 'WIN8', fixSessionCapabilities: false },
		{ browserName: 'internet explorer', version: '10', platform: 'WIN8', fixSessionCapabilities: false },
		{ browserName: 'internet explorer', version: '9', platform: 'WINDOWS', fixSessionCapabilities: false },
		{ browserName: 'firefox', version: '33', platform: [ 'WINDOWS', 'MAC' ], fixSessionCapabilities: false },
		{ browserName: 'chrome', version: '38', platform: [ 'WINDOWS', 'MAC' ], fixSessionCapabilities: false },
		{ browserName: 'safari', version: '8', platform: 'MAC', fixSessionCapabilities: false }
	],

	maxConcurrency: 2,
	tunnel: 'BrowserStackTunnel',

	reporters: [ 'combined' ],

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
