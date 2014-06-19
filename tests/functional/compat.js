/* jshint dojo:true, es3:false */
define([
	'intern!object',
	'intern/chai!assert',
	'dojo/node!leadfoot/compat',
	'dojo/topic',
	// require the runner reporter so it will have a subscription on the same sub/pub hub that our dojo/topic is using
	'../../lib/reporters/runner'
], function (registerSuite, assert, compat, topic) {
	var command = { setFindTimeout: function () {} };
	compat.applyTo(command);

	registerSuite({
		name: 'compat',

		// verify that leadfoot/compat deprecation messages are received by the runner reporter
		deprecation: function () {
			var deprecatedMethod;
			topic.subscribe('/deprecated', function (name) {
				deprecatedMethod = name;
			});
			command.setImplicitWaitTimeout();
			assert.equal(deprecatedMethod, 'Command#setImplicitWaitTimeout');
		}
	});
});
