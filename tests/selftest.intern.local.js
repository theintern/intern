define({
	proxyPort: 9000,
	proxyUrl: 'http://localhost:9000/',

	capabilities: {
		'selenium-version': '2.43.0',
		'idle-timeout': 30
	},
	environments: [		
		{ browserName: 'chrome' }
	],

	maxConcurrency: 2,
	tunnel: 'NullTunnel',
	
	tunnelOptions: {
		hostname: 'localhost',
		port: '4444'
	},
	
	loaders: {
		'host-node': 'dojo-loader/loader.js',
		'host-browser': 'node_modules/dojo-loader/loader.js'
	},

	loaderOptions: {
		// Packages that should be registered with the loader in each testing environment
		packages: [
			{ name: 'intern-selftest', location: '.' }
		],
		map: {
			'intern-selftest': {
				dojo: 'intern-selftest/node_modules/dojo',
				chai: 'intern-selftest/node_modules/chai/chai',
				diff: 'intern-selftest/node_modules/diff/diff'
			}
		}
	},

	suites: [
		'intern-selftest/tests/unit/all'
	],
	functionalSuites: [
		'intern-selftest/tests/functional/lib/ProxiedSession'
	],

	excludeInstrumentation: /(?:tests|node_modules)\//,

	isSelfTestConfig: true
});