define([ './wd' ], function (wd) {
	return function (browserType, config) {
		console.log('Creating browser ' + browserType);
		var browser = wd.remote(config.webdriver);
		return browser
			.init(browserType)
			.then(function loadClient() {
				console.log('Executing test suite in ' + browserType);

				// TODO: use io-query once it is stable
				return browser.get(config.clientHtmlLocation + '?reporter=webdriver' +
					'&suites=' + encodeURIComponent(config.suites.join(',')) +
					(config.packages ? '&packages=' + encodeURIComponent(JSON.stringify(config.packages)) : ''));
			})
			.then(function setAsyncTimeout() {
				return browser.setAsyncScriptTimeout(/* 10 minutes */ 10 * 60 * 1000);
			})
			.then(function registerConduit() {
				return browser.executeAsync('this.remoteTestCallback = arguments[0];');
			})
			.then(function reportResult(result) {
				return { browser: browser, result: JSON.parse(result) };
			}, function reportError(error) {
				return error;
			})
			.always(function cleanup(result) {
				return browser.quit().then(function returnResult() {
					return result;
				});
			});
	};
});