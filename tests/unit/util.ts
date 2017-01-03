define([
	'intern/dojo/node!../../util',
	'intern/dojo/node!fs',
	'intern/dojo/node!path',
	'intern!object',
	'intern/chai!assert'
], function (
	util,
	fs,
	path,
	registerSuite,
	assert
) {
	function rmFileAndDir(filename) {
		fs.unlinkSync(filename);
		while ((filename = path.dirname(filename)) && filename !== '.') {
			fs.rmdirSync(filename);
		}
	}

	registerSuite({
		name: 'unit/Tunnel',

		'.decompress': (function () {
			function decompressTest(data, length) {
				var buf = Buffer.alloc(length, data, 'base64');
				return util.decompress(buf, '.').then(function () {
					var filename = path.join('_a', '_c', 'bar.txt');
					try {
						fs.statSync(filename).isFile();
					}
					finally {
						rmFileAndDir(filename);
					}
				});
			}

			return {
				zip: function () {
					var zipData = 'UEsDBAoAAAAAACyNBEkAAAAAAAAAAAAAAAADABwAX2EvVVQJAAODtqNXmLajV3V4CwABBPUBAAAEFAAAAFBLAwQKAAAAAAAwjQRJAAAAAAAAAAAAAAAABgAcAF9hL19jL1VUCQADjLajV5i2o1d1eAsAAQT1AQAABBQAAABQSwMECgAAAAAAMI0ESeE5e8wEAAAABAAAAA0AHABfYS9fYy9iYXIudHh0VVQJAAOMtqNXjLajV3V4CwABBPUBAAAEFAAAAGJhegpQSwECHgMKAAAAAAAsjQRJAAAAAAAAAAAAAAAAAwAYAAAAAAAAABAA7UEAAAAAX2EvVVQFAAODtqNXdXgLAAEE9QEAAAQUAAAAUEsBAh4DCgAAAAAAMI0ESQAAAAAAAAAAAAAAAAYAGAAAAAAAAAAQAO1BPQAAAF9hL19jL1VUBQADjLajV3V4CwABBPUBAAAEFAAAAFBLAQIeAwoAAAAAADCNBEnhOXvMBAAAAAQAAAANABgAAAAAAAEAAACkgX0AAABfYS9fYy9iYXIudHh0VVQFAAOMtqNXdXgLAAEE9QEAAAQUAAAAUEsFBgAAAAADAAMA6AAAAMgAAAAAAA==';
					return decompressTest(zipData, 454);
				},

				tgz: function () {
					var tgzData = 'H4sIAMrio1cAA+3SSwrCMBSF4YxdRVZg82yWU1KhAwcKbQVx9V5MEXRQRIgi/t/kDBLITU663KjajDEpRn3LtqRxoeRCW5eirEp4baxNLigdq08mTtOcRxlln6fjYWWfbBuGlfXlHvf8EV1uul3lL/B6/947G6R/51Ki/08o/fd53M7nudIZ8h5tCGv9h6f+fUyt0qbSPA/+vP8+XzbfngEAAAAAAAAAAAAAAADvuwLY0q/2ACgAAA==';
					return decompressTest(tgzData, 184);
				}
			};
		})(),

		'.fileExists': function () {
			assert.isTrue(util.fileExists('Tunnel.js'));
			assert.isFalse(util.fileExists('Tunnel.jsx'));
		},

		'.on': function () {
			var added;
			var removed;
			var emitter = {
				on: function (event, listener) {
					added = { event: event, listener: listener };
				},
				removeListener: function (event, listener) {
					removed = { event: event, listener: listener };
				}
			};

			var handle = util.on(emitter, 'foo', 'bar');
			assert.deepEqual(added, { event: 'foo', listener: 'bar' });
			assert.property(handle, 'remove');

			handle.remove();
			assert.deepEqual(removed, { event: 'foo', listener: 'bar' });
		},

		'.writeFile': function () {
			var filename = path.join('_a', '_b', 'foo.txt');
			return util.writeFile('foo\n', filename).then(function () {
				try {
					fs.statSync(filename).isFile();
				}
				finally {
					rmFileAndDir(filename);
				}
			});
		}
	});
});
