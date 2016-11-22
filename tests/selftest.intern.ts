define({
	proxyPort: 9000,
	proxyUrl: 'http://localhost:9000/',

	capabilities: {
		'idle-timeout': 60
	},
	environments: [
		{ browserName: 'internet explorer', version: '11.0', platform: 'WINDOWS', fixSessionCapabilities: false },
		{ browserName: 'internet explorer', version: '10.0', platform: 'WIN8', fixSessionCapabilities: false },
		{ browserName: 'internet explorer', version: '9.0', platform: 'WINDOWS', fixSessionCapabilities: false },
		{ browserName: 'firefox', version: [ '33', '49' ], platform: [ 'WINDOWS', 'MAC' ],
			fixSessionCapabilities: false },
		{ browserName: 'chrome', version: [ '38', '52' ], platform: [ 'WINDOWS', 'MAC' ],
			fixSessionCapabilities: false },
		{ browserName: 'safari', version: [ '9', '10' ], fixSessionCapabilities: false }
	],

	maxConcurrency: 2,
	tunnel: 'BrowserStackTunnel',

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
