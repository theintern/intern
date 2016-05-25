define([
	'dojo/aspect',
	'dojo/topic',
	'dojo/request',
	'dojo/Promise',
	'../util',
	'require'
], function (aspect, topic, request, Promise, util, require) {
	function scroll() {
		window.scrollTo(0, document.documentElement.scrollHeight || document.body.scrollHeight);
	}

	function WebDriver(config) {
		config = config || {};

		this.sequence = 0;
		this.url = require.toUrl('intern/');
		this.publishHandle;
		this.writeHtml = config.writeHtml !== false;
		this.sessionId = config.internConfig.sessionId;
		this.waitForRunner = config.waitForRunner;
		this.maxPostSize = config.maxPostSize || 50000;

		if (this.writeHtml) {
			this.suiteNode = document.body;
		}

		this._messageBuffer = [];
	}

	WebDriver.prototype = {
		$others: function (name) {
			// never send coverage events; coverage is handled explicitly by Proxy
			if (name !== 'coverage' && name !== 'run') {
				return this._send(Array.prototype.slice.call(arguments, 0));
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
				this.suiteNode = this.suiteNode.parentNode.parentNode || document.body;
			}

			return this._sendEvent('suiteEnd', arguments);
		},

		suiteStart: function (suite) {
			if (this.writeHtml) {
				var oldSuiteNode = this.suiteNode;
				this.suiteNode = document.createElement('ol');

				if (oldSuiteNode === document.body) {
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

				scroll();
			}

			return this._sendEvent('suiteStart', arguments);
		},

		testStart: function (test) {
			if (this.writeHtml) {
				this.testNode = document.createElement('li');
				this.testNode.appendChild(document.createTextNode(test.name));
				this.suiteNode.appendChild(this.testNode);
				scroll();
			}

			return this._sendEvent('testStart', arguments);
		},

		testPass: function (test) {
			if (this.writeHtml) {
				this.testNode.appendChild(document.createTextNode(' passed (' + test.timeElapsed + 'ms)'));
				this.testNode.style.color = 'green';
				scroll();
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
				scroll();
			}

			return this._sendEvent('testSkip', arguments);
		},

		testFail: function (test) {
			if (this.writeHtml) {
				this.testNode.appendChild(document.createTextNode(' failed (' + test.timeElapsed + 'ms)'));
				this.testNode.style.color = 'red';

				var errorNode = document.createElement('pre');
				errorNode.appendChild(document.createTextNode(test.error.stack || test.error));
				this.testNode.appendChild(errorNode);
				scroll();
			}

			return this._sendEvent('testFail', arguments);
		},

		_sendEvent: function (name, args) {
			return this._send([ name ].concat(Array.prototype.slice.call(args, 0)));
		},

		_send: function (data) {
			var self = this;

			// Send a message, or schedule it to be sent. Return a promise that resolves when the message has been sent.
			function sendRequest() {
				// Send all buffered messages and empty the buffer. Note that the posted data will always be an array of
				// objects.
				function send() {
					// Some testing services have problems handling large message POSTs, so limit the maximum size of
					// each POST body to maxPostSize bytes. Always send at least one message, even if it's more than
					// maxPostSize bytes.
					function sendNextBlock() {
						var block = [ messages.shift() ];
						var size = block[0].length;
						while (messages.length > 0 && size + messages[0].length < self.maxPostSize) {
							size += messages[0].length;
							block.push(messages.shift());
						}

						return request.post(self.url, {
							headers: { 'Content-Type': 'application/json' },
							data: JSON.stringify(block)
						}).then(function () {
							if (messages.length > 0) {
								return sendNextBlock();
							}
						});
					}

					var messages = self._messageBuffer;
					self._messageBuffer = [];

					self._activeRequest = new Promise(function (resolve, reject) {
						return sendNextBlock().then(function () {
							self._activeRequest = null;
							resolve();
						}).catch(function (error) {
							self._activeRequest = null;
							reject(error);
						});
					});

					return self._activeRequest;
				}

				if (self._activeRequest || self._pendingRequest) {
					if (!self._pendingRequest) {
						// Schedule another request after the active one completes
						self._pendingRequest = self._activeRequest.then(function () {
							self._pendingRequest = null;
							return send();
						});
					}
					return self._pendingRequest;
				}
				else {
					return send();
				}
			}

			data = data.map(function (item) {
				return item instanceof Error ?
					{ name: item.name, message: item.message, stack: item.stack } : item;
			});

			this._messageBuffer.push(JSON.stringify({
				sequence: this.sequence,
				// Although sessionId is passed as part of the payload, it is passed in the message object as
				// well to allow the conduit to be fully separate and encapsulated from the rest of the code
				sessionId: this.sessionId,
				payload: data
			}));

			// The sequence must not be incremented until after the data is successfully serialised, since an error
			// during serialisation might occur, which would mean the request is never sent, which would mean the
			// dispatcher on the server-side will stall because the sequence numbering will be wrong
			this.sequence++;

			var shouldWait = util.getShouldWait(this.waitForRunner, data);

			if (shouldWait) {
				return sendRequest();
			}
			else {
				sendRequest();
			}
		}
	};

	return WebDriver;
});
