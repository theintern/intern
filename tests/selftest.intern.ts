export const proxyPort = 9000;
export const proxyUrl = 'http://localhost:9000/';

export const capabilities = {
	'selenium-version': '2.43.0',
	'idle-timeout': 30
};
export const environments = [
	{ browserName: 'internet explorer', version: '11.0', platform: 'Windows 10', fixSessionCapabilities: false },
	{ browserName: 'internet explorer', version: '10.0', platform: 'Windows 8', fixSessionCapabilities: false },
	{ browserName: 'internet explorer', version: '9.0', platform: 'Windows 7', fixSessionCapabilities: false },
	{ browserName: 'firefox', version: '33.0', platform: [ 'Windows 7', 'OS X 10.11' ], fixSessionCapabilities: false },
	{ browserName: 'chrome', version: '38.0', platform: [ 'Windows 7', 'OS X 10.11' ], fixSessionCapabilities: false },
	{ browserName: 'safari', version: '9.0', platform: 'OS X 10.11', fixSessionCapabilities: false }
];

export const maxConcurrency = 2;
export const tunnel = 'SauceLabsTunnel';

export const loaderOptions = {
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
};

export const suites = [
	'intern-selftest/dist/tests/unit/all'
];
export const functionalSuites = [
	'intern-selftest/dist/tests/functional/lib/ProxiedSession'
];

export const excludeInstrumentation = /(?:tests|node_modules)\//;

export const isSelfTestConfig = true;
