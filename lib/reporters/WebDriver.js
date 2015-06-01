define([
	'dojo/aspect',
	'dojo/topic',
	'dojo/request',
	'require'
], function (aspect, topic, request, require) {
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

		if (this.writeHtml) {
			this.suiteNode = document.body;
		}
	}

	WebDriver.prototype = {
		$others: function (name) {
			// never send coverage events; coverage is handled explicitly by Proxy
			if (name !== 'coverage' && name !== 'run') {
				return this._send(Array.prototype.slice.call(arguments, 0));
			}
		},

		fatalError: function (error) {
			return this._sendEvent('fatalError', [ error ]);
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
			data = data.map(function (item) {
				return item instanceof Error ?
					{ name: item.name, message: item.message, stack: item.stack } : item;
			});

			var response = request.post(this.url, {
				headers: {
					'Content-Type': 'application/json'
				},
				data: JSON.stringify({
					sequence: this.sequence,
					// Although sessionId is passed as part of the payload, it is passed in the message object as well
					// to allow the conduit to be fully separate and encapsulated from the rest of the code
					sessionId: this.sessionId,
					payload: data
				})
			});

			// The sequence must not be incremented until after the data is successfully serialised, since an error
			// during serialisation might occur, which would mean the request is never sent, which would mean the
			// dispatcher on the server-side will stall because the sequence numbering will be wrong
			++this.sequence;

			return response;
		}
	};

	return WebDriver;
});
