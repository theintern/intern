define([
	'../util',
	// Conditional load sendData for testability
	'dojo/has!host-browser?../sendData',
	'require'
], function (
	util,
	sendData,
	require
) {
	function WebDriver(config) {
		config = config || {};

		this.url = require.toUrl('intern/');
		this.publishHandle;
		this.writeHtml = config.writeHtml !== false;
		this.sessionId = config.internConfig.sessionId;
		this.waitForRunner = config.waitForRunner;

		if (config.maxPostSize != null) {
			sendData.setMaxPostSize(config.maxPostSize);
		}

		if (this.writeHtml) {
			this.reporterNode = document.createElement('div');
			document.body.appendChild(this.reporterNode);
			this.suiteNode = this.reporterNode;
		}
	}

	WebDriver.prototype = {
		$others: function (name) {
			// never send coverage events; coverage is handled explicitly by Proxy
			if (name !== 'coverage' && name !== 'run') {
				return this._sendEvent(name, Array.prototype.slice.call(arguments, 1));
			}
		},

		// runStart/runEnd data is not used by the test runner, so do not send it to save bandwidth
		runEnd: function () {
			return this._sendEvent('runEnd', []);
		},

		runStart: function () {
			return this._sendEvent('runStart', []);
		},

		suiteEnd: function () {
			if (this.writeHtml) {
				if (!this.reporterNode.parentNode) {
					document.body.appendChild(this.reporterNode);
				}
				if (!this.suiteNode.parentNode) {
					this.reporterNode.appendChild(this.suiteNode);
				}
				this.suiteNode = this.suiteNode.parentNode.parentNode === document.body ?
					this.reporterNode : this.suiteNode.parentNode.parentNode;
			}

			return this._sendEvent('suiteEnd', arguments);
		},

		suiteStart: function (suite) {
			if (this.writeHtml) {
				var oldSuiteNode = this.suiteNode;
				this.suiteNode = document.createElement('ol');

				if (oldSuiteNode === this.reporterNode) {
					oldSuiteNode.appendChild(this.suiteNode);
				}
				else {
					var outerSuiteNode = document.createElement('li');
					var headerNode = document.createElement('div');

					headerNode.appendChild(document.createTextNode(suite.name));
					outerSuiteNode.appendChild(headerNode);
					outerSuiteNode.appendChild(this.suiteNode);
					oldSuiteNode.appendChild(outerSuiteNode);
				}

				this._scroll();
			}

			return this._sendEvent('suiteStart', arguments);
		},

		suiteError: function(suite, error) {
			if (this.writeHtml) {
				this.suiteNode.appendChild(document.createTextNode('Suite "' + suite.id + '" failed'));
				this.suiteNode.style.color = 'red';

				var errorNode = document.createElement('pre');
				errorNode.appendChild(document.createTextNode(util.getErrorMessage(error)));
				this.suiteNode.appendChild(errorNode);
				this._scroll();
			}

			return this._sendEvent('suiteError', arguments);
		},

		testStart: function (test) {
			if (this.writeHtml) {
				this.testNode = document.createElement('li');
				this.testNode.appendChild(document.createTextNode(test.name));
				this.suiteNode.appendChild(this.testNode);
				this._scroll();
			}

			return this._sendEvent('testStart', arguments);
		},

		testPass: function (test) {
			if (this.writeHtml) {
				this.testNode.appendChild(document.createTextNode(' passed (' + test.timeElapsed + 'ms)'));
				this.testNode.style.color = 'green';
				this._scroll();
			}

			return this._sendEvent('testPass', arguments);
		},

		testSkip: function (test) {
			if (this.writeHtml) {
				var testNode = this.testNode = document.createElement('li');
				testNode.appendChild(document.createTextNode(test.name + ' skipped' +
					(test.skipped ? ' (' + test.skipped + ')' : '')));
				testNode.style.color = 'gray';
				this.suiteNode.appendChild(testNode);
				this._scroll();
			}

			return this._sendEvent('testSkip', arguments);
		},

		testFail: function (test) {
			if (this.writeHtml) {
				this.testNode.appendChild(document.createTextNode(' failed (' + test.timeElapsed + 'ms)'));
				this.testNode.style.color = 'red';

				var errorNode = document.createElement('pre');
				errorNode.appendChild(document.createTextNode(util.getErrorMessage(test.error)));
				this.testNode.appendChild(errorNode);
				this._scroll();
			}

			return this._sendEvent('testFail', arguments);
		},

		_sendEvent: function (name, args) {
			var data = [ name ].concat(Array.prototype.slice.call(args, 0));
			var shouldWait = util.getShouldWait(this.waitForRunner, data);
			var promise = sendData.send(this.url, data, this.sessionId);

			if (shouldWait) {
				return promise;
			}
		},

		_scroll: function () {
			window.scrollTo(0, document.documentElement.scrollHeight || document.body.scrollHeight);
		}
	};

	return WebDriver;
});
