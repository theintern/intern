import SeleniumTunnel from 'src/SeleniumTunnel';
import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';

registerSuite({
	name: 'unit/SeleniumTunnel',

	config: {
		'name only': function () {
			const tunnel = new SeleniumTunnel({ drivers: [ 'chrome' ] });
			assert.isFalse(tunnel.isDownloaded);
		},

		'config object': function () {
			const tunnel = new SeleniumTunnel({ drivers: [ { executable: 'README.md', url: '', seleniumProperty: '' } ] });
			Object.defineProperty(tunnel, 'artifact', { value: '.' });
			Object.defineProperty(tunnel, 'directory', { value: '.' });
			assert.isTrue(tunnel.isDownloaded);
		},

		'invalid name': function () {
			assert.throws(function () {
				const tunnel = new SeleniumTunnel({ drivers: <any>[ 'foo' ] });
				Object.defineProperty(tunnel, 'artifact', { value: '.' });
				Object.defineProperty(tunnel, 'directory', { value: '.' });
				tunnel.isDownloaded;
			}, /Invalid driver/);
		},

		'config object with invalid name': function () {
			assert.throws(function () {
				const tunnel = new SeleniumTunnel({ drivers: [ { name: 'foo' } ] });
				Object.defineProperty(tunnel, 'artifact', { value: '.' });
				Object.defineProperty(tunnel, 'directory', { value: '.' });
				tunnel.isDownloaded;
			}, /Invalid driver/);
		}
	}
});
