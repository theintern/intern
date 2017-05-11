export const capabilities = {
	'selenium-version': '2.43.0',
	'idle-timeout': 30
};

export const environments = [
	{ browserName: 'microsoftedge', fixSessionCapabilities: false },
	{ browserName: 'internet explorer', version: [ '9', '10', '11' ], fixSessionCapabilities: false },
	{ browserName: 'firefox', version: [ '33', 'latest' ], platform: [ 'WINDOWS', 'MAC' ], fixSessionCapabilities: false },
	{ browserName: 'chrome', version: [ '38', 'latest' ], platform: [ 'WINDOWS', 'MAC' ], fixSessionCapabilities: false },
	{ browserName: 'safari', version: [ '9', '10' ], fixSessionCapabilities: false }
];

export const maxConcurrency = 2;
export const tunnel = 'BrowserStackTunnel';

export const loaderOptions = {
	packages: [
		{ name: 'src', location: '_build/src' },
		{ name: 'tests', location: '_build/tests' },
		{ name: 'dojo', location: 'node_modules/dojo'}
	],
	map: {
		'tests': {
			// map the absolute module `src` so that it uses
			// the srcLoader to get a relative commonjs library
			'src': 'tests/srcLoader!../src',
			// ensure the `dojo` being used in the tests is the
			// same `dojo` being used by the commonjs library
			// with the exception of `dojo/node`
			'dojo': 'dojo/node!dojo',
			'dojo/node': 'dojo/node'
		},
		'tests/srcLoader': {
			'src': 'src'
		}
	}
};

export const loaders = {
	'host-node': '@dojo/loader'
};

export let suites: string[] = [];

if (typeof process !== 'undefined') {
	suites.push('tests/unit/lib/util');
}

export const functionalSuites = [
	'tests/functional/helpers/pollUntil',
	'tests/functional/Server',
	'tests/functional/Session',
	'tests/functional/Element',
	'tests/functional/Command'
];

export const excludeInstrumentation = /\b(?:tests|node_modules)\//;

export const filterErrorStack = true;
