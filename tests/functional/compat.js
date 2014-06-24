/* jshint dojo:true, es3:false */
define([
	'intern!object',
	'intern/chai!assert',
	'dojo/node!leadfoot/compat',
	// require the runner reporter to hook up a /deprecated topic listener
	'../../lib/reporters/runner'
], function (registerSuite, assert, compat) {
	var deprecationMessage;
	var command = { setFindTimeout: function () {} };
	compat.applyTo(command);

	registerSuite({
		name: 'compat',

		// Verify that leadfoot/compat deprecation messages are received by the runner reporter. This test is only
		// meaningful the first time it's run; every other time it uses the result captured in the first run.
		deprecation: function () {
			if (deprecationMessage) {
				return;
			}

			var consoleWarn = console.warn;
			console.warn = function(message) {
				deprecationMessage = message;
			};
			try {
				command.setImplicitWaitTimeout();
				assert.include(deprecationMessage, 'Command#setImplicitWaitTimeout is deprecated');
			}
			finally {
				console.warn = consoleWarn;
			}
		}
	});
});
