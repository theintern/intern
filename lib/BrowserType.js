define([], function () {
	function BrowserType(kwArgs) {
		for (var k in kwArgs) {
			this[k] = kwArgs[k];
		}
	}

	BrowserType.prototype = {
		browserName: undefined,
		browserVersion: undefined,
		platformName: undefined,
		platformVersion: undefined,
		toString: function () {
			var parts = [];

			parts.push(this.browserName || 'Any browser');
			this.browserVersion && parts.push(this.browserVersion);
			parts.push('on ' + (this.platformName || 'any platform'));
			this.platformVersion && parts.push(this.platformVersion);

			return parts.join(' ');
		}
	};

	return BrowserType;
});