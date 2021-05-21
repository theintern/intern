define({
	proxyPort: 9000,
	proxyMaxPort: 9003,
	proxyUrl: 'http://localhost:9000/',

	capabilities: {
		'idle-timeout': 60
	},
	environments: [
		{ browserName: 'chrome', version: [ '90' ], platform: [ 'LINUX' ],
			fixSessionCapabilities: false },
	],

	maxConcurrency: 2,
	tunnel: 'SeleniumTunnel',
	tunnelOptions: {
		drivers: [ 'chrome' ]
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
				diff: 'intern-selftest/node_modules/diff/diff',
				benchmark: 'intern-selftest/node_modules/benchmark/benchmark',
				lodash: 'intern-selftest/node_modules/lodash-amd/main',
				platform: 'intern-selftest/node_modules/platform/platform'
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
