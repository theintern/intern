define([
	'intern!object',
	'intern/chai!assert',
	'dojo/Promise',
	'../../../../lib/commands/resolveEnvironments',
	'../../../../lib/EnvironmentType'
], function (registerSuite, assert, Promise, resolveEnvironments, EnvironmentType) {
	var availableChrome = [
		{
			browserName: 'chrome',
			version: 39
		},
		{
			browserName: 'chrome',
			version: 38
		},
		{
			browserName: 'chrome',
			version: 37
		},
		{
			browserName: 'chrome',
			version: 36
		}
	];
	var sortedChrome = availableChrome.sort(versionSort);
	var availableIe = [
		{
			browserName: 'ie',
			version: 11
		},
		{
			browserName: 'ie',
			version: 10
		}
	];

	function versionSort(a, b) {
		return parseInt(b.version) - parseInt(a.version);
	}

	function assertEnvironments(actual, expected) {
		assert.deepEqual(actual, expected.map(function (expected) {
			return new EnvironmentType(expected);
		}));
	}

	function assertResolveEnvironments(environments, available, expected) {
		var capabilities = {};
		available = available.then ? available : Promise.resolve(available);
		return resolveEnvironments(capabilities, environments, available)
			.then(function (actual) {
				assertEnvironments(actual, expected);
			});
	}

	registerSuite({
		name: 'commands/resolveEnvironments',
		
		'no version, is passed through': function () {
			var environments = [
				{
					browserName: 'chrome',
					platformVersion: '10'
				}
			];

			return assertResolveEnvironments(environments, availableChrome, environments /* expected */);
		},
		
		'numeric version, is passed through': function () {
			var environments = [
				{
					browserName: 'chrome',
					version: 39,
					platformVersion: '10'
				}
			];

			return assertResolveEnvironments(environments, availableChrome, environments /* expected */);
		},

		'latest version alias': function () {
			var environments = [
				{
					browserName: 'chrome',
					version: 'latest'
				}
			];

			var expected = [
				{
					browserName: 'chrome',
					version: sortedChrome[0].version
				}
			];

			return assertResolveEnvironments(environments, availableChrome, expected);
		},
		
		'latest-1 version alias': function () {
			var environments = [
				{
					browserName: 'chrome',
					version: 'latest-1'
				}
			];

			var expected = [
				{
					browserName: 'chrome',
					version: sortedChrome[1].version
				}
			];

			return assertResolveEnvironments(environments, availableChrome, expected);
		},
		
		'basic version range': function () {
			var environments = [
				{
					browserName: 'chrome',
					version: '38..39'
				}
			];

			var expected = [
				{
					browserName: 'chrome',
					version: 38
				},
				{
					browserName: 'chrome',
					version: 39
				}
			];

			return assertResolveEnvironments(environments, availableChrome, expected);
		},
		
		'ranged number .. latest': function () {
			var environments = [
				{
					browserName: 'chrome',
					version: '37..latest'
				}
			];

			var expected = [
				{
					browserName: 'chrome',
					version: 37
				},
				{
					browserName: 'chrome',
					version: 38
				},
				{
					browserName: 'chrome',
					version: 39
				}
			];

			return assertResolveEnvironments(environments, availableChrome, expected);
		},

		'ranged math latest - 2 .. latest': function () {
			var environments = [
				{
					browserName: 'chrome',
					version: 'latest-2..latest'
				}
			];

			var expected = [
				{
					browserName: 'chrome',
					version: 37
				},
				{
					browserName: 'chrome',
					version: 38
				},
				{
					browserName: 'chrome',
					version: 39
				}
			];

			return assertResolveEnvironments(environments, availableChrome, expected);
		},

		'ranged math latest - 2 .. latest with multiple browsers': function () {
			var available = [].concat(availableChrome, availableIe);
			var environments = [
				{
					browserName: ['chrome', 'ie'],
					version: 'latest-1..latest'
				}
			];

			var expected = [
				{
					browserName: 'chrome',
					version: 38
				},
				{
					browserName: 'chrome',
					version: 39
				},
				{
					browserName: 'ie',
					version: 10
				},
				{
					browserName: 'ie',
					version: 11
				}
			];

			return assertResolveEnvironments(environments, available, expected);
		},
		
		'ranged math out of bounds; throws': function () {
			var environments = [
				{
					browserName: 'ie',
					version: '3..latest'
				}
			];

			return Promise.resolve(availableIe)
				.then(function (available) {
					assert.throws(function () {
						resolveEnvironments({}, environments, available);
					});
				});
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
		
		'invalid range syntax': function () {
			var environments = [
				{
					browserName: 'ie',
					version: 'latest-2..latest-1..latest'
				}
			];

			return Promise.resolve(availableIe)
				.then(function (available) {
					assert.throws(function () {
						resolveEnvironments({}, environments, available);
					});
				});
		},
		
		'fixes backwards ranges': function () {
			var environments = [
				{
					browserName: 'chrome',
					version: 'latest..latest-2'
				}
			];

			var expected = [
				{
					browserName: 'chrome',
					version: 37
				},
				{
					browserName: 'chrome',
					version: 38
				},
				{
					browserName: 'chrome',
					version: 39
				}
			];

			return assertResolveEnvironments(environments, availableChrome, expected);
		},
		
		'tries for best-fit with version ranges when using numbers': function () {
			var environments = [
				{
					browserName: 'ie',
					version: '1..12'
				}
			];

			var expected = [
				{
					browserName: 'ie',
					version: 10
				},
				{
					browserName: 'ie',
					version: 11
				}
			];

			return assertResolveEnvironments(environments, availableIe, expected);
		}
	});
});
