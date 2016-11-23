export const proxyPort = 9000;
export const proxyUrl = 'http://localhost:9000/';

export const capabilities = {
	'selenium-version': '2.43.0',
	'idle-timeout': 60
};
export const environments = [
	{ browserName: 'internet explorer', version: '11.0', platform: 'WINDOWS', fixSessionCapabilities: false },
	{ browserName: 'internet explorer', version: '10.0', platform: 'WIN8', fixSessionCapabilities: false },
	{ browserName: 'internet explorer', version: '9.0', platform: 'WINDOWS', fixSessionCapabilities: false },
	{ browserName: 'firefox', version: [ '33', '49' ], platform: [ 'WINDOWS', 'MAC' ], fixSessionCapabilities: false },
	{ browserName: 'chrome', version: [ '38', '52' ], platform: [ 'WINDOWS', 'MAC' ], fixSessionCapabilities: false },
	{ browserName: 'safari', version: [ '9', '10' ], fixSessionCapabilities: false } ];

export const maxConcurrency = 2;
export const tunnel = 'BrowserStackTunnel';

function getPackageMap() {
	return {
		dojo: 'node_modules/dojo',
		chai: 'node_modules/chai/chai',
		diff: 'node_modules/diff/diff',
		benchmark: 'node_modules/benchmark/benchmark'
	};
}

export const loaderOptions = {
	// Packages that should be registered with the loader in each testing environment
	packages: [
		{ name: 'tests', location: '_build/tests' },
		{ name: 'src', location: '_build/src' },
		{ name: 'lodash', location: 'node_modules/lodash-amd' },
		{ name: 'platform', location: 'node_modules/platform', main: 'platform' }
	],
	map: {
		'tests': getPackageMap(),
		'src': getPackageMap()
	}
};

export const suites = [
	'tests/unit/all'
];
export const functionalSuites = [
	'tests/functional/lib/ProxiedSession'
];

export const excludeInstrumentation = /(?:tests|node_modules|browser_modules)\//;

export const isSelfTestConfig = true;
