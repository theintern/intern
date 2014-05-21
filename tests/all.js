/* jshint dojo:true */
define([
	'dojo/node!../SauceLabsTunnel',
	'dojo/node!../BrowserStackTunnel',
	'dojo/node!../TestingBotTunnel',
	'dojo/node!fs',
	'dojo/node!path',
	'intern!object',
	'intern/lib/args'
], function (
	SauceLabsTunnel,
	BrowserStackTunnel,
	TestingBotTunnel,
	fs,
	pathUtil,
	registerSuite,
	args
) {
	function cleanup(tunnel) {
		if (args.noClean) {
			return;
		}

		function deleteRecursive(dir) {
			var files = [];
			if (fs.existsSync(dir)) {
				files = fs.readdirSync(dir);
				files.forEach(function(file) {
					var path = pathUtil.join(dir, file);
					if (fs.lstatSync(path).isDirectory()) {
						deleteRecursive(path);
					}
					else {
						fs.unlinkSync(path);
					}
				});
				fs.rmdirSync(dir);
			}
		}

		deleteRecursive(tunnel.directory);
	}

	function tunnelTest(dfd, tunnel, check) {
		cleanup(tunnel);

		if (args.showStdout) {
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
	}

	var tunnel;

	registerSuite({
		name: 'digdug',

		afterEach: function () {
			if (tunnel.isRunning) {
				tunnel.stop();
			}
			cleanup(tunnel);
			tunnel = null;
		},

		'Sauce Labs': function () {
			tunnel = new SauceLabsTunnel();
			tunnelTest(this.async(), tunnel, function (error) {
				return /Not authorized/.test(error.message);
			});
		},

		'BrowserStack': function () {
			tunnel = new BrowserStackTunnel();
			tunnelTest(this.async(), tunnel, function (error) {
				return /The tunnel reported:/.test(error.message);
			});
		},

		'TestingBot': function () {
			tunnel = new TestingBotTunnel();
			tunnelTest(this.async(), tunnel, function (error) {
				return /Could not get tunnel info/.test(error.message);
			});
		}
	});
});
