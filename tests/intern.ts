import { args } from 'intern';

export const capabilities = {
	'idle-timeout': 30
};

export const environments = [
	{ browserName: 'microsoftedge', fixSessionCapabilities: false },
	{
		browserName: 'internet explorer',
		version: ['10', '11'],
		fixSessionCapabilities: false
	},
	{
		browserName: 'firefox',
		version: '33',
		platform: ['WINDOWS', 'MAC'],
		fixSessionCapabilities: false
	},
	{
		// latest version
		browserName: 'firefox',
		platform: ['WINDOWS', 'MAC'],
		fixSessionCapabilities: false,
		supportsSessionCommands: false,

		// Needed for file download support
		// See https://github.com/mozilla/geckodriver/issues/858#issuecomment-322505259
		'moz:firefoxOptions': {
			prefs: { 'dom.file.createInChild': true }
		},

		// Firefox 55 needs at least Selenium 3.5.2 and geckodriver 0.18.0 for
		// reasonable feature support
		'browserstack.selenium_version': '3.5.2',
		'browserstack.geckodriver': '0.18.0'
	},
	{
		browserName: 'chrome',
		version: '38',
		platform: ['WINDOWS', 'MAC'],
		fixSessionCapabilities: false
	},
	{
		// latest version
		browserName: 'chrome',
		platform: ['WINDOWS', 'MAC'],
		fixSessionCapabilities: false,
		'browserstack.selenium_version': '3.5.2'
	},
	{
		// latest version
		browserName: 'safari',
		fixSessionCapabilities: false
	}
];

export const maxConcurrency = 2;
export let tunnel = 'BrowserStackTunnel';

export const loaderOptions = {
	packages: [
		{ name: 'src', location: '_build/src' },
		{ name: 'tests', location: '_build/tests' },
		{ name: 'dojo', location: 'node_modules/dojo' }
	],
	map: {
		tests: {
			// map the absolute module `src` so that it uses
			// the srcLoader to get a relative commonjs library
			src: 'tests/srcLoader!../src',
			// ensure the `dojo` being used in the tests is the
			// same `dojo` being used by the commonjs library
			// with the exception of `dojo/node`
			dojo: 'dojo/node!dojo',
			'dojo/node': 'dojo/node'
		},
		'tests/srcLoader': {
			src: 'src'
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

if (args.service === 'sauce') {
	const platforms: { [key: string]: string } = {
		WINDOWS: 'Windows 10',
		MAC: 'OS X 10.12'
	};
	environments.forEach((environment: any) => {
		if (environment.platform) {
			environment.platform = environment.platform.map(
				(platform: string) => {
					return platforms[platform] || platform;
				}
			);
		}
	});
	tunnel = 'SauceLabsTunnel';
} else if (args.service === 'testingbot') {
	const platforms: { [key: string]: string } = {
		WINDOWS: 'WIN10',
		MAC: 'SIERRA'
	};
	environments.forEach((environment: any) => {
		if (environment.platform) {
			environment.platform = environment.platform.map(
				(platform: string) => {
					return platforms[platform] || platform;
				}
			);
		}
	});
	tunnel = 'TestingBotTunnel';
}
