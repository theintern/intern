define([
	'intern',
	'./cleanup'
], function (intern, cleanup) {
	/**
	 * Utility for testing tunnel startup
	 */
	return function tunnelTest(dfd, tunnel, check) {
		cleanup(tunnel);
		check = check || function () {
			return false;
		};

		if (intern.args.showStdout) {
			tunnel.on('stdout', console.log);
			tunnel.on('stderr', console.log);
		}

		tunnel.start().then(function () {
			dfd.resolve();
		}).catch(function (error) {
			if (check(error)) {
				dfd.resolve();
			}
			else {
				dfd.reject(error);
			}
		});
	};
});
