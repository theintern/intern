define({
	proxyPort: 9000,
	proxyUrl: 'http://localhost:9000/',

	capabilities: {
		'selenium-version': '2.43.0',
		'idle-timeout': 30
	},
	environments: [
		{ browserName: 'internet explorer', version: '11', platform: 'Windows 8.1' },
		{ browserName: 'internet explorer', version: '10', platform: 'Windows 8' },
		{ browserName: 'internet explorer', version: [ '8', '9' ], platform: 'Windows 7' },
		{ browserName: 'internet explorer', version: [ '6', '7' ], platform: 'Windows XP' },
		{ browserName: 'firefox', version: '33', platform: [ 'Windows 7', 'OS X 10.10', 'Linux' ] },
		{ browserName: 'chrome', version: '38', platform: [ 'Windows 7', 'OS X 10.10', 'Linux' ] },
		{ browserName: 'safari', version: '8', platform: 'OS X 10.10' }
	],

	maxConcurrency: 3,
	tunnel: 'SauceLabsTunnel',

	loader: {
		// Packages that should be registered with the loader in each testing environment
		packages: [
			{ name: 'intern-selftest', location: '.' }
		],
		map: {
			'intern-selftest': {
				dojo: 'intern-selftest/node_modules/dojo',
				diff: 'intern-selftest/node_modules/diff/diff',

				// TODO: This is a hack -- it should be replaced when the Dojo loader has been fixed.
				// We need to load a custom dojo/node for dependencies like
				// "dojo/has!host-node?dojo/node!istanbul/lib/hook", but the current 1.9.3 loader won't do that with a
				// simple 'dojo/node' mapping.
				'intern-selftest/node_modules/dojo/node': 'intern-selftest/lib/node'
			}
		}
	},

	suites: [
		'intern-selftest/tests/unit/all'
	],
	functionalSuites: [
		'intern-selftest/tests/functional/lib/ProxiedSession'
	],

	excludeInstrumentation: /^(?:tests|node_modules)\//,

	isSelfTestConfig: true
});
