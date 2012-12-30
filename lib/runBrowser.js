define([
	'./wd',
	'./BrowserType'
], function (wd, BrowserType) {
	return function (browserType, config) {
		console.log('Creating browser ' + browserType);
		var browser = wd.remote(config.webdriver);
		return browser
			.init(browserType)
			.then(function getBrowserInfo(sessionId) {
				// wd incorrectly puts the session ID on a sessionID property
				browser.sessionId = sessionId;
				return browser.sessionCapabilities();
			})
			.then(function (capabilities) {
				browser.type = new BrowserType(capabilities);
				return browser;
			});
	};
});