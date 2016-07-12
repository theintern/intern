var Decompress = require('decompress');
var Promise = require('dojo/Promise');
var fs = require('fs');
var mkdirp = require('mkdirp');
var pathUtil = require('path');

/**
 * Convenience function for internally resolving a Promise
 */
function resolver(resolve, reject, error, value) {
	if (error) {
		reject(error);
	}
	else {
		resolve(value);
	}
}

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
			var decompressor = new Decompress();
			decompressor.src(data)
				.use(Decompress.zip())
				.use(Decompress.targz())
				.dest(directory)
				.run(function (error) {
					resolver(resolve, reject, error);
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
			mkdirp(pathUtil.dirname(filename), function (error) {
				if (error) {
					reject(error);
				}
				else {
					fs.writeFile(filename, data, function (error) {
						resolver(resolve, reject, error);
					});
				}
			});
		});
	}
};
