/**
 * This reporter enables Intern to interact with TeamCity.
 * http://confluence.jetbrains.com/display/TCD8/Build+Script+Interaction+with+TeamCity
 *
 * Portions of this module are based on functions from teamcity-service-messages:
 * https://github.com/pifantastic/teamcity-service-messages.
 */
define(['../util'], function (util) {
	function TeamCity(config) {
		config = config || {};

		this.output = config.output;
	}

	TeamCity.prototype = {
		/**
		 * Escape a string for TeamCity output.
		 *
		 * @param  {string} string
		 * @return {string}
		 *
		 * Based on Message.prototype.escape from teamcity-service-messages
		 */
		_escapeString: function (string) {
			var replacer = /['\n\r\|\[\]\u0100-\uffff]/g,
				map = {
					'\'': '|\'',
					'|': '||',
					'\n': '|n',
					'\r': '|r',
					'[': '|[',
					']': '|]'
				};

			return string.replace(replacer, function (character) {
				if (character in map) {
					return map[character];
				}
				if (/[^\u0000-\u00ff]/.test(character)) {
					return '|0x' + character.charCodeAt(0).toString(16);
				}
				return '';
			});
		},

		/**
		 * Output a TeamCity message.
		 *
		 * @param  {string} type
		 * @param  {Object}  args
		 *
		 * Based on Message.prototype.formatArgs from teamcity-service-messages
		 */
		_sendMessage: function (type, args) {
			var self = this;

			args.timestamp = new Date().toISOString().slice(0, -1);
			args = Object.keys(args).map(function (key) {
				var value = String(args[key]);
				return key + '=' + '\'' + self._escapeString(value) + '\'';
			}).join(' ');

			this.output.write('##teamcity[' + type + ' ' + args + ']\n');
		},

		testStart: function (test) {
			this._sendMessage('testStarted', { name: test.name, flowId: test.sessionId });
		},

		testSkip: function (test) {
			this._sendMessage('testIgnored', { name: test.name, flowId: test.sessionId });
		},

		testEnd: function (test) {
			this._sendMessage('testFinished', {
				name: test.name,
				duration: test.timeElapsed,
				flowId: test.sessionId
			});
		},

		testFail: function (test) {
			var message = {
				name: test.name,
				message: util.getErrorMessage(test.error),
				flowId: test.sessionId
			};

			if (test.error.actual && test.error.expected) {
				message.type = 'comparisonFailure';
				message.expected = test.error.expected;
				message.actual = test.error.actual;
			}

			this._sendMessage('testFailed', message);
		},

		suiteStart: function (suite) {
			this._sendMessage('testSuiteStarted', {
				name: suite.name,
				startDate: new Date(),
				flowId: suite.sessionId
			});
		},

		suiteEnd: function (suite) {
			this._sendMessage('testSuiteFinished', {
				name: suite.name,
				duration: suite.timeElapsed,
				flowId: suite.sessionId
			});
		},

		suiteError: function (suite) {
			this._sendMessage('message', {
				name: suite.name,
				flowId: suite.sessionId,
				text: 'SUITE ERROR',
				errorDetails: util.getErrorMessage(suite.error),
				status: 'ERROR'
			});
		}
	};

	return TeamCity;
});
