/* jshint dojo:true, es3:false */
define([
	'intern!object',
	'intern/chai!assert',
	'dojo/node!leadfoot/compat',
	'dojo/topic',
	// require the runner reporter so it will have a subscription on the same sub/pub hub that our dojo/topic is using
	'../../lib/reporters/runner'
], function (registerSuite, assert, compat, topic) {
	var deprecatedMethod;
	var command = { setFindTimeout: function () {} };
	compat.applyTo(command);

	var handle = topic.subscribe('/deprecated', function (name) {
		deprecatedMethod = name;
		handle.remove();
	});

	registerSuite({
		name: 'compat',

		// Verify that leadfoot/compat deprecation messages are received by the runner reporter. This test is only
		// meaningful the first time it's run; every other time it uses the result captured in the first run.
		deprecation: function () {
			command.setImplicitWaitTimeout();
			assert.equal(deprecatedMethod, 'Command#setImplicitWaitTimeout');
		}
	});
});
