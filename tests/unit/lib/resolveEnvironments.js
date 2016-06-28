define([
	'intern!object',
	'intern/chai!assert',
	'dojo/Promise',
	'../../../lib/resolveEnvironments',
	'../../../lib/EnvironmentType'
], function (registerSuite, assert, Promise, resolveEnvironments, EnvironmentType) {
	var availableChrome = [
		{ browserName: 'chrome', version: 39 },
		{ browserName: 'chrome', version: 38 },
		{ browserName: 'chrome', version: 37 },
		{ browserName: 'chrome', version: 36 }
	];
	var sortedChrome = availableChrome.slice().sort(versionSort);
	var availableIe = [
		{ browserName: 'ie', version: 11 },
		{ browserName: 'ie', version: 10 }
	];

	function versionSort(a, b) {
		return parseInt(b.version) - parseInt(a.version);
	}

	function assertResolve(capabilities, environments, available, expected, message) {
		var actual = resolveEnvironments(capabilities, environments, available);
		assert.deepEqual(actual, expected.map(function (expected) {
			return new EnvironmentType(expected);
		}), message);
	}

	function assertResolveEnvironments(environments, available, expected, message) {
		assertResolve({}, environments, available, expected, message);
	}

	registerSuite({
		name: 'commands/resolveEnvironments',
		
		'no version, is passed through': function () {
			var environments = [ { browserName: 'chrome', platformVersion: '10' } ];
			assertResolveEnvironments(environments, availableChrome, environments);
		},

		'numeric version, is passed through': function () {
			var environments = [ { browserName: 'chrome', version: 39, platformVersion: '10' } ];
			assertResolveEnvironments(environments, availableChrome, environments);
		},

		'permutations': (function () {
			var base = { platformName: 'windows', platformVersion: 8 };

			return {
				'just a base; returns an empty list': function () {
					assertResolve(base, [], null, [ base ], 'Permuting only the base should return 1 result');
				},

				'single source without permutations; returns base + source': function () {
					var sources = [ { browserName: 'chrome', browserVersion: 'latest' } ];
					var expected = [
						{
							browserName: 'chrome',
							browserVersion: 'latest',
							platformName: 'windows',
							platformVersion: 8
						}
					];
					assertResolve(base, sources, null, expected, 'their contents should be equal');
				},

				'single source overriding base property': function () {
					var sources = [ { platformName: 'linux' } ];
					var expected = [ { platformName: 'linux', platformVersion: 8 } ];
					assertResolve(base, sources, null, expected, 'their contents should be equal');
				},

				'single permutation (n); returns n * (base + source)': function () {
					var sources = [
						{
							browserName: 'chrome',
							browserVersion: [ 'latest', 'latest-1' ]
						}
					];
					var expected = [
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
					assertResolve(base, sources, null, expected, 'their contents should be equal');
				},

				'multiple permutations (n, m); returns n * m * (base + source)': function () {
					var sources = [
						{
							browserName: [ 'chrome', 'ie' ],
							browserVersion: [ 'latest', 'latest-1' ]
						}
					];
					var expected = [
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
					assertResolve(base, sources, null, expected, 'their contents should be equal');
				},

				'multiple sources (s), single permutation; returns all sources mixed into base': function () {
					var sources = [
						{
							browserName: 'chrome',
							browserVersion: [ 'latest', 'latest-1' ]
						},
						{
							browserName: 'ie',
							browserVersion: [ 'latest', 'latest-1' ]
						}
					];
					var expected = [
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
					assertResolve(base, sources, null, expected, 'their contents should be equal');
				},

				'multiple sources (s), multiple permutations (n, m); returns s * n * m permutations': function () {
					var sources = [
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
					var expected = [
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
					assertResolve(base, sources, null, expected, 'their contents should be equal');
				},
				
				'multiple everything': function () {
					var base = { isCapabilities: true };
					var sources = [
						{
							browserName: [ 'a', 'b' ],
							version: [ '1', '2' ],
							platform: [ 'c', 'd' ],
							platformVersion: [ '3', '4' ]
						}
					];
					var expected = [
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
					assertResolve(base, sources, null, expected, 'their contents should be equal');
				}
			};
		}()),

		'version aliases': {
			'latest version alias': function () {
				var environments = [ { browserName: 'chrome', version: 'latest' } ];
				var expected = [ { browserName: 'chrome', version: sortedChrome[0].version } ];
				return assertResolveEnvironments(environments, availableChrome, expected);
			},
			
			'latest-1 version alias': function () {
				var environments = [ { browserName: 'chrome', version: 'latest-1' } ];
				var expected = [ { browserName: 'chrome', version: sortedChrome[1].version } ];
				return assertResolveEnvironments(environments, availableChrome, expected);
			}
		},
		
		'version ranges': {
			'basic version range': function () {
				var environments = [ { browserName: 'chrome', version: '38..39' } ];
				var expected = [
					{ browserName: 'chrome', version: 38 },
					{ browserName: 'chrome', version: 39 }
				];
				return assertResolveEnvironments(environments, availableChrome, expected);
			},
			
			'ranged number .. latest': function () {
				var environments = [ { browserName: 'chrome', version: '37..latest' } ];
				var expected = [
					{ browserName: 'chrome', version: 37 },
					{ browserName: 'chrome', version: 38 },
					{ browserName: 'chrome', version: 39 }
				];
				return assertResolveEnvironments(environments, availableChrome, expected);
			},

			'ranged math latest-2..latest': function () {
				var environments = [ { browserName: 'chrome', version: 'latest-2..latest' } ];
				var expected = [
					{ browserName: 'chrome', version: 37 },
					{ browserName: 'chrome', version: 38 },
					{ browserName: 'chrome', version: 39 }
				];
				return assertResolveEnvironments(environments, availableChrome, expected);
			},

			'ranged math latest-1..latest with multiple browsers': function () {
				var available = [].concat(availableChrome, availableIe);
				var environments = [ { browserName: ['chrome', 'ie'], version: 'latest-1..latest' } ];
				var expected = [
					{ browserName: 'chrome', version: 38 },
					{ browserName: 'chrome', version: 39 },
					{ browserName: 'ie', version: 10 },
					{ browserName: 'ie', version: 11 }
				];
				return assertResolveEnvironments(environments, available, expected);
			},
			
			'ranged math out of bounds; throws': function () {
				var environments = [ { browserName: 'ie', version: '3..latest' } ];
				assert.throws(function () {
					resolveEnvironments({}, environments, availableIe);
				});
			}
		},
		
		'does not filter on properties not present in available environments': function () {
			var environments = [
				{
					browserName: 'chrome',
					version: 'latest',
					platformName: 'os2/warp', // not present in available environments
					platformVersion: 10 // not present in available environments
				}
			];
			var expected = [
				{
					browserName: 'chrome',
					version: sortedChrome[0].version,
					platformName: 'os2/warp',
					platformVersion: 10
				}
			];
			return assertResolveEnvironments(environments, availableChrome, expected);
		},
		
		'invalid range syntax': {
			'multiple ranges': function () {
				var environments = [ { browserName: 'ie', version: 'latest-2..latest-1..latest' } ];
				assert.throws(function () {
					resolveEnvironments({}, environments, availableIe);
				});
			},

			'non-numeric offset': function () {
				var environments = [ { browserName: 'ie', version: '10..latest-a' } ];
				assert.throws(function () {
					resolveEnvironments({}, environments, availableIe);
				});
			},

			'backwards ranges': function () {
				var environments = [ { browserName: 'chrome', version: 'latest..latest-2' } ];
				assert.throws(function () {
					resolveEnvironments({}, environments, availableChrome);
				});
			}
		}
	});
});
