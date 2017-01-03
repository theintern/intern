var Decompress = require('decompress');
var Promise = require('dojo/Promise');
var fs = require('fs');
var path = require('path');

module.exports = {
	/**
	 * Adds properties from source objects to a target object using ES5 `Object.defineProperty` instead of
	 * `[[Set]]`. This is necessary when copying properties that are ES5 accessor/mutators.
	 *
	 * @param {Object} target The object to which properties are added.
	 * @param {...Object} source The source object from which properties are taken.
	 * @returns {Object} The target object.
	 */
	mixin: function (target) {
		for (var i = 1, j = arguments.length; i < j; ++i) {
			var source = arguments[i];
			for (var key in source) {
				if (hasOwnProperty.call(source, key)) {
					Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
				}
			}
		}

		return target;
	},

	/**
	 * Attaches an event to a Node.js EventEmitter and returns a handle for removing the listener later.
	 *
	 * @param {EventEmitter} emitter A Node.js EventEmitter object.
	 * @param {string} event The name of the event to listen for.
	 * @param {Function} listener The event listener that will be invoked when the event occurs.
	 * @returns {{ remove: Function }} A remove handle.
	 */
	on: function (emitter, event, listener) {
		emitter.on(event, listener);
		return {
			remove: function () {
				this.remove = function () {};
				emitter.removeListener(event, listener);
			}
		};
	},

	/**
	 * Returns true if a file or directory exists
	 *
	 * @param {string} filename
	 * @returns {bool} true if filename exists, false otherwise
	 */
	fileExists: function (filename) {
		try {
			fs.statSync(filename);
			return true;
		}
		catch (error) {
			return false;
		}
	},

	/**
	 * Decompresses archive data into a given directory
	 *
	 * @param {Buffer} data 
	 * @param {string} directory
	 * @returns {Promise.<void>} A Promise that resolves when the data is decompressed
	 */
	decompress: function (data, directory) {
		return new Promise(function (resolve, reject) {
			var decompressor = new Decompress()
				.src(data)
				.dest(directory)
				.use(Decompress.zip())
				.use(Decompress.targz());
			decompressor.run(function (error, files) {
				if (error) {
					reject(error);
				}
				else {
					resolve(files);
				}
			});
		});
	},

	/**
	 * Writes data to a file.
	 *
	 * The file's parent directories will be created if they do not already exist.
	 *
	 * @param {Buffer} data 
	 * @param {string} filename
	 * @returns {Promise.<void>} A Promise that resolves when the file has been written
	 */
	writeFile: function (data, filename) {
		return new Promise(function (resolve, reject) {
			function mkdirp(dir) {
				if (!dir) {
					return;
				}

				try {
					fs.mkdirSync(dir);
				}
				catch (error) {
					// A parent directory didn't exist, create it
					if (error.code === 'ENOENT') {
						mkdirp(path.dirname(dir));
						mkdirp(dir);
					}
					else {
						if (!fs.statSync(dir).isDirectory()) {
							throw error;
						}
					}
				}
			}

			mkdirp(path.dirname(filename));
			fs.writeFile(filename, data, function (error) {
				if (error) {
					reject(error);
				}
				else {
					resolve();
				}
			});
		});
	}
};
