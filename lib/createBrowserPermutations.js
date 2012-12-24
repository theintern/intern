define([], function () {
	return function (browsers) {
		// TODO: This is really stupid non-generic combination code.
		var flattenedBrowsers = [];
		browsers.forEach(function (browser) {
			var versions = [].concat(browser.version),
				platforms = [].concat(browser.platform);

			versions.forEach(function (version) {
				platforms.forEach(function (platform) {
					browser = Object.create(browser);
					browser.version = version;
					browser.platform = platform;
					flattenedBrowsers.push(browser);
				});
			});
		});

		return flattenedBrowsers;
	};
});