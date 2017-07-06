import { NormalizedEnvironment } from '@theintern/digdug/Tunnel';
import Environment from 'src/lib/Environment';
import resolveEnvironments, { EnvironmentOptions } from 'src/lib/resolveEnvironments';

const availableChrome: NormalizedEnvironment[] = [
	{ browserName: 'chrome', version: 'beta', platform: 'windows', descriptor: {}, intern: { platform: '', browserName: '', version: '' } },
	{ browserName: 'chrome', version: 'dev', platform: 'windows', descriptor: {}, intern: { platform: '', browserName: '', version: '' } },
	{ browserName: 'chrome', version: 'alpha', platform: 'windows', descriptor: {}, intern: { platform: '', browserName: '', version: '' } },
	{ browserName: 'chrome', version: '39', platform: 'windows', descriptor: {}, intern: { platform: '', browserName: '', version: '' } },
	{ browserName: 'chrome', version: '38', platform: 'windows', descriptor: {}, intern: { platform: '', browserName: '', version: '' } },
	{ browserName: 'chrome', version: '37', platform: 'windows', descriptor: {}, intern: { platform: '', browserName: '', version: '' } },
	{ browserName: 'chrome', version: '36', platform: 'windows', descriptor: {}, intern: { platform: '', browserName: '', version: '' } }
];
const availableIe: NormalizedEnvironment[] = [
	{ browserName: 'ie', version: '11', platform: 'windows', descriptor: {}, intern: { platform: '', browserName: '', version: '' } },
	{ browserName: 'ie', version: '10', platform: 'windows', descriptor: {}, intern: { platform: '', browserName: '', version: '' } }
];

function assertResolve(capabilities: { [key: string]: any }, environments: EnvironmentOptions[], available?: NormalizedEnvironment[], expected?: any, message?: string) {
	const actual = resolveEnvironments(capabilities, environments, available);
	assert.deepEqual(actual, expected.map((expected: any) => new Environment(expected)), message);
}

function assertResolveEnvironments(environments: EnvironmentOptions[], available: NormalizedEnvironment[], expected: any, message?: string) {
	assertResolve({}, environments, available, expected, message);
}

registerSuite('lib/resolveEnvironments', {
	'no version, is passed through'() {
		const environments = <EnvironmentOptions[]>[ { browserName: 'chrome', platformVersion: '10' } ];
		assertResolveEnvironments(environments, availableChrome, environments);
	},

	'numeric version, is passed through'() {
		const environments = <EnvironmentOptions[]>[ { browserName: 'chrome', version: 39, platformVersion: '10' } ];
		assertResolveEnvironments(environments, availableChrome, environments);
	},

	'permutations': (function () {
		const base = { platformName: 'windows', platformVersion: 8 };

		return {
			'just a base; returns an empty list'() {
				assertResolve(base, [], undefined, [ base ], 'Permuting only the base should return 1 result');
			},

			'single source without permutations; returns base + source'() {
				const sources = [ { browserName: 'chrome', browserVersion: 'latest' } ];
				const expected = [
					{
						browserName: 'chrome',
						browserVersion: 'latest',
						platformName: 'windows',
						platformVersion: 8
					}
				];
				assertResolve(base, sources, undefined, expected, 'their contents should be equal');
			},

			'single source overriding base property'() {
				const sources = [ { browserName: 'chrome', platformName: 'linux' } ];
				const expected = [ { browserName: 'chrome', platformName: 'linux', platformVersion: 8 } ];
				assertResolve(base, sources, undefined, expected, 'their contents should be equal');
			},

			'single permutation (n); returns n * (base + source)'() {
				const sources = [
					{
						browserName: 'chrome',
						browserVersion: [ 'latest', 'latest-1' ]
					}
				];
				const expected = [
					{
						browserName: 'chrome',
						browserVersion: 'latest',
						platformName: 'windows',
						platformVersion: 8
					},
					{
						browserName: 'chrome',
						browserVersion: 'latest-1',
						platformName: 'windows',
						platformVersion: 8
					}
				];
				assertResolve(base, sources, undefined, expected, 'their contents should be equal');
			},

			'multiple permutations (n, m); returns n * m * (base + source)'() {
				const sources = [
					{
						browserName: [ 'chrome', 'ie' ],
						browserVersion: [ 'latest', 'latest-1' ]
					}
				];
				const expected = [
					{
						browserName: 'chrome',
						browserVersion: 'latest',
						platformName: 'windows',
						platformVersion: 8
					},
					{
						browserName: 'ie',
						browserVersion: 'latest',
						platformName: 'windows',
						platformVersion: 8
					},
					{
						browserName: 'chrome',
						browserVersion: 'latest-1',
						platformName: 'windows',
						platformVersion: 8
					},
					{
						browserName: 'ie',
						browserVersion: 'latest-1',
						platformName: 'windows',
						platformVersion: 8
					}
				];
				assertResolve(base, sources, undefined, expected, 'their contents should be equal');
			},

			'multiple sources (s), single permutation; returns all sources mixed into base'() {
				const sources = [
					{
						browserName: 'chrome',
						browserVersion: [ 'latest', 'latest-1' ]
					},
					{
						browserName: 'ie',
						browserVersion: [ 'latest', 'latest-1' ]
					}
				];
				const expected = [
					{
						browserName: 'chrome',
						browserVersion: 'latest',
						platformName: 'windows',
						platformVersion: 8
					},
					{
						browserName: 'chrome',
						browserVersion: 'latest-1',
						platformName: 'windows',
						platformVersion: 8
					},
					{
						browserName: 'ie',
						browserVersion: 'latest',
						platformName: 'windows',
						platformVersion: 8
					},
					{
						browserName: 'ie',
						browserVersion: 'latest-1',
						platformName: 'windows',
						platformVersion: 8
					}
				];
				assertResolve(base, sources, undefined, expected, 'their contents should be equal');
			},

			'multiple sources (s), multiple permutations (n, m); returns s * n * m permutations'() {
				const sources = [
					{
						browserName: 'chrome',
						browserVersion: [ 'latest', 'latest-1' ],
						platformName: [ 'windows', 'mac' ]
					},
					{
						browserName: 'ie',
						browserVersion: [ 'latest', 'latest-1' ]
					}
				];
				const expected = [
					{
						browserName: 'chrome',
						browserVersion: 'latest',
						platformName: 'windows',
						platformVersion: 8
					},
					{
						browserName: 'chrome',
						browserVersion: 'latest-1',
						platformName: 'windows',
						platformVersion: 8
					},
					{
						browserName: 'chrome',
						browserVersion: 'latest',
						platformName: 'mac',
						platformVersion: 8
					},
					{
						browserName: 'chrome',
						browserVersion: 'latest-1',
						platformName: 'mac',
						platformVersion: 8
					},
					{
						browserName: 'ie',
						browserVersion: 'latest',
						platformName: 'windows',
						platformVersion: 8
					},
					{
						browserName: 'ie',
						browserVersion: 'latest-1',
						platformName: 'windows',
						platformVersion: 8
					}
				];
				assertResolve(base, sources, undefined, expected, 'their contents should be equal');
			},

			'multiple everything'() {
				const base = { isCapabilities: true };
				const sources = [
					{
						browserName: [ 'a', 'b' ],
						version: [ '1', '2' ],
						platform: [ 'c', 'd' ],
						platformVersion: [ '3', '4' ]
					}
				];
				const expected = [
					{ browserName: 'a', version: '1', platform: 'c', platformVersion: '3', isCapabilities: true },
					{ browserName: 'b', version: '1', platform: 'c', platformVersion: '3', isCapabilities: true },

					{ browserName: 'a', version: '2', platform: 'c', platformVersion: '3', isCapabilities: true },
					{ browserName: 'b', version: '2', platform: 'c', platformVersion: '3', isCapabilities: true },

					{ browserName: 'a', version: '1', platform: 'd', platformVersion: '3', isCapabilities: true },
					{ browserName: 'b', version: '1', platform: 'd', platformVersion: '3', isCapabilities: true },

					{ browserName: 'a', version: '2', platform: 'd', platformVersion: '3', isCapabilities: true },
					{ browserName: 'b', version: '2', platform: 'd', platformVersion: '3', isCapabilities: true },

					{ browserName: 'a', version: '1', platform: 'c', platformVersion: '4', isCapabilities: true },
					{ browserName: 'b', version: '1', platform: 'c', platformVersion: '4', isCapabilities: true },

					{ browserName: 'a', version: '2', platform: 'c', platformVersion: '4', isCapabilities: true },
					{ browserName: 'b', version: '2', platform: 'c', platformVersion: '4', isCapabilities: true },

					{ browserName: 'a', version: '1', platform: 'd', platformVersion: '4', isCapabilities: true },
					{ browserName: 'b', version: '1', platform: 'd', platformVersion: '4', isCapabilities: true },

					{ browserName: 'a', version: '2', platform: 'd', platformVersion: '4', isCapabilities: true },
					{ browserName: 'b', version: '2', platform: 'd', platformVersion: '4', isCapabilities: true }
				];
				assertResolve(base, sources, undefined, expected, 'their contents should be equal');
			}
		};
	}()),

	'version aliases': {
		'latest version alias'() {
			const environments = [ { browserName: 'chrome', version: 'latest' } ];
			const expected = [ { browserName: 'chrome', version: '39' } ];
			return assertResolveEnvironments(environments, availableChrome, expected);
		},

		'latest-1 version alias'() {
			const environments = [ { browserName: 'chrome', version: 'latest-1' } ];
			const expected = [ { browserName: 'chrome', version: '38' } ];
			return assertResolveEnvironments(environments, availableChrome, expected);
		}
	},

	'version ranges': {
		'basic version range'() {
			const environments = [ { browserName: 'chrome', version: '38..39' } ];
			const expected = [
				{ browserName: 'chrome', version: '38' },
				{ browserName: 'chrome', version: '39' }
			];
			return assertResolveEnvironments(environments, availableChrome, expected);
		},

		'ranged number .. latest'() {
			const environments = [ { browserName: 'chrome', version: '37..latest' } ];
			const expected = [
				{ browserName: 'chrome', version: '37' },
				{ browserName: 'chrome', version: '38' },
				{ browserName: 'chrome', version: '39' }
			];
			return assertResolveEnvironments(environments, availableChrome, expected);
		},

		'ranged math latest-2..latest'() {
			const environments = [ { browserName: 'chrome', version: 'latest-2..latest' } ];
			const expected = [
				{ browserName: 'chrome', version: '37' },
				{ browserName: 'chrome', version: '38' },
				{ browserName: 'chrome', version: '39' }
			];
			return assertResolveEnvironments(environments, availableChrome, expected);
		},

		'ranged math latest-1..latest with multiple browsers'() {
			const available: NormalizedEnvironment[] = availableChrome.concat(availableIe);
			const environments = [ { browserName: ['chrome', 'ie'], version: 'latest-1..latest' } ];
			const expected = [
				{ browserName: 'chrome', version: '38' },
				{ browserName: 'chrome', version: '39' },
				{ browserName: 'ie', version: '10' },
				{ browserName: 'ie', version: '11' }
			];
			return assertResolveEnvironments(environments, available, expected);
		},

		'ranged math out of bounds; throws'() {
			const environments = [ { browserName: 'ie', version: '3..latest' } ];
			assert.throws(function () {
				resolveEnvironments({}, environments, availableIe);
			});
		}
	},

	'does not filter on properties not present in available environments'() {
		const environments = [
			{
				browserName: 'chrome',
				version: 'latest',
				platformName: 'os2/warp', // not present in available environments
				platformVersion: 10 // not present in available environments
			}
		];
		const expected = [
			{
				browserName: 'chrome',
				version: '39',
				platformName: 'os2/warp',
				platformVersion: 10
			}
		];
		return assertResolveEnvironments(environments, availableChrome, expected);
	},

	'invalid range syntax': {
		'multiple ranges'() {
			const environments = [ { browserName: 'ie', version: 'latest-2..latest-1..latest' } ];
			assert.throws(function () {
				resolveEnvironments({}, environments, availableIe);
			}, /Invalid version syntax/);
		},

		'non-numeric offset'() {
			const environments = [ { browserName: 'ie', version: '10..latest-a' } ];
			assert.throws(function () {
				resolveEnvironments({}, environments, availableIe);
			}, /Invalid alias syntax/);
		},

		'backwards ranges'() {
			const environments = [ { browserName: 'chrome', version: 'latest..latest-2' } ];
			assert.throws(function () {
				resolveEnvironments({}, environments, availableChrome);
			}, /Invalid range/);
		},

		'offset too large'() {
			const environments = [ { browserName: 'chrome', version: 'latest-12' } ];
			assert.throws(function () {
				resolveEnvironments({}, environments, availableChrome);
			}, /versions are available/);
		},

		'range unavailable'() {
			const environments = [ { browserName: 'chrome', version: '1..3' } ];
			assert.throws(function () {
				resolveEnvironments({}, environments, availableChrome);
			}, /The version range .* is unavailable/);
		},

		'extra minuses'() {
			const environments = [ { browserName: 'chrome', version: 'latest-2-3' } ];
			assert.throws(function () {
				resolveEnvironments({}, environments, availableChrome);
			}, /Invalid alias syntax/);
		}
	}
});
