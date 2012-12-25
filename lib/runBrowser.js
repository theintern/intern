define([ './wd' ], function (wd) {
	return function (browserType, config, testConfig) {
		console.log('Creating browser ' + browserType);
		var browser = wd.remote(config.webdriver);
		return browser
			.init(browserType)
			.then(function loadClient() {
				console.log('Executing test suite in ' + browserType);
				return browser.get(config.clientHtmlLocation + '?reporter=webdriver&suites=' + testConfig.suites);
			})
			.then(function setAsyncTimeout() {
				return browser.setAsyncScriptTimeout(/* 10 minutes */ 10 * 60 * 1000);
			})
			.then(function registerConduit() {
				return browser.executeAsync('this.remoteTestCallback = arguments[0];');
			})
			.always(function cleanup(result) {
				return browser.quit().then(function returnResult() {
					return result;
				});
			})
			.always(function reportResult(result) {
				return { browser: browser, result: JSON.parse(result) };
			});
	};
});