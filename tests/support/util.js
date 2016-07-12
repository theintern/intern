define([
	'intern',
	'intern/dojo/node!fs',
	'intern/dojo/node!path',
	'intern/dojo/Promise'
], function (
	intern,
	fs,
	pathUtil,
	Promise
) {
	/**
	 * Cleans up a tunnel by stopping it if the tunnel is running and deleting its target install directory
	 *
	 * @param tunnel
	 * @return {Promise} A promise that resolves when cleanup is complete
	 */
	function cleanup(tunnel) {
		if (!tunnel) {
			return;
		}

		if (tunnel.isRunning) {
			return tunnel.stop().finally(deleteTunnelFiles);
		}
		else {
			deleteTunnelFiles(tunnel);
			return Promise.resolve();
		}
	}

	/**
	 * Deletes a tunnel's target install directory
	 */
	function deleteTunnelFiles(tunnel) {
		function deleteRecursive(dir) {
			var files = [];
			if (fs.existsSync(dir)) {
				files = fs.readdirSync(dir);
				files.forEach(function(file) {
					var path = pathUtil.join(dir, file);
					try {
						if (fs.lstatSync(path).isDirectory()) {
							deleteRecursive(path);
						}
						else {
							fs.unlinkSync(path);
						}
					}
					catch (error) {
						if (error.code !== 'ENOENT') {
							console.warn('Unable to delete ' + path, error);
						}
					}
				});
				fs.rmdirSync(dir);
			}
		}

		if (!tunnel || intern.args.noClean) {
			return;
		}

		deleteRecursive(tunnel.directory);
	}

	return {
		cleanup: cleanup,

		deleteTunnelFiles: deleteTunnelFiles
	};
});
