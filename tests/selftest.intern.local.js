define(['./selftest.intern'], function (selfTest) {

	selfTest.environments = [
		{ browserName: 'chrome' }
	];

	selfTest.loaders = {
		'host-node': 'dojo-loader/loader.js',
		'host-browser': 'browser_modules/dojo-loader/loader.js'
	};

	selfTest.tunnel = 'NullTunnel';

	selfTest.tunnelOptions = {
		hostname: 'localhost',
		port: '4444'
	};

	return selfTest;
});