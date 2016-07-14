define([
	'intern/dojo/node!../../SeleniumTunnel',
	'intern!object',
	'intern/chai!assert'
], function (
	SeleniumTunnel,
	registerSuite,
	assert
) {
	registerSuite({
		name: 'unit/SeleniumTunnel',

		config: {
			'name only': function () {
				var tunnel = new SeleniumTunnel({ drivers: [ 'chrome' ] });
				assert.isFalse(tunnel.isDownloaded);
			},

			'config object': function () {
				var tunnel = new SeleniumTunnel({
					directory: '.',
					artifact: '.',
					drivers: [ { name: 'chrome', executable: 'README.md' } ]
				});
				assert.isTrue(tunnel.isDownloaded);
			},

			'definition object': function () {
				var tunnel = new SeleniumTunnel({
					directory: '.',
					artifact: '.',
					drivers: [ { executable: 'README.md' } ]
				});
				assert.isTrue(tunnel.isDownloaded);
			},

			'invalid name': function () {
				assert.throws(function () {
					var tunnel = new SeleniumTunnel({ drivers: [ 'foo' ] });
					tunnel.isDownloaded;
				}, /Invalid driver/);
			},

			'config object with invalid name': function () {
				assert.throws(function () {
					var tunnel = new SeleniumTunnel({ drivers: [ { name: 'foo' } ] });
					tunnel.isDownloaded;
				}, /Invalid driver/);
			}
		}
	});
});
