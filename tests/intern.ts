export const proxyPort = 9000;

export const proxyUrl = 'http://localhost:9000';

export const maxConcurrency = 3;

export const loaderOptions = {
	packages: [
		{ name: 'src', location: '_build/src' },
		{ name: 'tests', location: './_build/tests' }
	],
	map: {
		tests: {
			// map the absolute module `src` so that it uses
			// the srcLoader to get a relative commonjs library
			src: 'tests/srcLoader!../src',
			// ensure the `dojo` being used in the tests is the
			// same `dojo` being used by the commonjs library
			// with the exception of `dojo/node`
			dojo: 'intern/dojo/node!dojo',
			'intern/dojo/node': 'intern/browser_modules/dojo/node',

			fs: 'intern/dojo/node!fs',
			path: 'intern/dojo/node!path',
			util: 'intern/dojo/node!util',
			url: 'intern/dojo/node!url',
			https: 'intern/dojo/node!https'
		},
		'tests/srcLoader': {
			src: 'src'
		}
	}
};

export const loaders = {
	'host-node': '@dojo/loader'
};

export const reporters = ['Console'];

export const suites = ['tests/unit/all', 'tests/integration/all'];

export const excludeInstrumentation = /^(?:_build\/tests|node_modules)\//;

export const filterErrorStack = true;
