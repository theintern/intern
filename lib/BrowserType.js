define([], function () {
	function BrowserType(kwArgs) {
		for (var k in kwArgs) {
			this[k] = kwArgs[k];
		}

		// The way that WebDriver actually works right now and the W3C Working Draft disagree on these properties;
		// the draft says platformName and browserVersion, the WebDriver API says platform and version. So use the
		// draft spec by default but provide the old options for compatibility.
		this.platform = this.platformName;
		this.version = this.browserVersion;
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