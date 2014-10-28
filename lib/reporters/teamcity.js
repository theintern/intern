/**
 * This reporter enables Intern to interact with TeamCity.
 * http://confluence.jetbrains.com/display/TCD8/Build+Script+Interaction+with+TeamCity
 *
 * Portions of this module are based on functions from teamcity-service-messages:
 * https://github.com/pifantastic/teamcity-service-messages.
 */
define([], function () {
	var teamcity = {
		/** Start times for test suites. */
		_suiteStarts: {},

		/** Unique ID used to track messages in a build. */
		_flowId: 1,

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
			args.flowId = ++teamcity._flowId;
			args.timestamp = new Date().toISOString().slice(0, -1);
			args = Object.keys(args).map(function (key) {
				var value = args[key].toString();
				return key + '=' + '\'' + teamcity._escapeString(value) + '\'';
			}).join(' ');
			console.log('##teamcity[' + type + ' ' + args + ']');
		},

		'/test/start': function (test) {
			teamcity._sendMessage('testStarted', { name: test.id });
		},

		'/test/skip': function (test) {
			teamcity._sendMessage('testIgnored', { name: test.id });
		},

		'/test/end': function (test) {
			teamcity._sendMessage('testFinished', {
				name: test.id,
				duration: test.timeElapsed
			});
		},

		'/test/fail': function (test) {
			var message = {
				name: test.id,
				message: test.error.message
			};

			if (test.error.actual && test.error.expected) {
				message.type = 'comparisonFailure';
				message.expected = test.error.expected;
				message.actual = test.error.actual;
			}

			teamcity._sendMessage('testFailed', message);
		},

		'/suite/start': function (suite) {
			if (suite.root) {
				return;
			}

			var startDate = teamcity._suiteStarts[suite.id] = new Date();

			teamcity._sendMessage('testSuiteStarted', {
				name: suite.id,
				startDate: startDate
			});
		},

		'/suite/end': function (suite) {
			if (suite.root) {
				return;
			}

			teamcity._sendMessage('testSuiteFinished', {
				name: suite.id,
				duration: new Date() - teamcity._suiteStarts[suite.id]
			});
		}
	};

	return teamcity;
});
