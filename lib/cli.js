var exports = module.exports;

var os = require('os');

/**
 * Ensures that a semver is contained in a range
 */
exports.acceptVersion = function (version, minVersion, maxVersion) {
	var semver = require('semver');
	var range = '>=' + minVersion;
	if (maxVersion) {
		range += ' <=' + maxVersion;
	}
	return semver.satisfies(version.split('-')[0], range);
};

/**
 * Collects values into an array
 */
exports.collect = function (val, arr) {
	arr.push(val);
	return arr;
};

/**
 * Synchronously copies files or directories
 */
exports.copy = function (src, dst) {
	var fs = require('fs');
	var path = require('path');

	if (fs.statSync(src).isDirectory()) {
		try {
			fs.mkdirSync(dst);
		}
		catch (error) {
			if (error.code !== 'EEXIST') {
				throw error;
			}
		}

		fs.readdirSync(src).forEach(function (filename) {
			exports.copy(path.join(src, filename), path.join(dst, filename));
		});
	}
	else {
		var data = fs.readFileSync(src);
		fs.writeFileSync(dst, data);
	}
};

/**
 * Ensures a value is part of an enum
 */
exports.enumArg = function (choices, val) {
	if (choices.indexOf(val) === -1) {
		exports.die('error: expected "' + val + '" to be one of {' + choices.join(', ') + '}');
	}
	return val;
};

/**
 * Get the exit code corresponding to a signal name
 */
exports.exitCodeForSignal = function (signalName) {
	return 128 + (os.constants.signals[signalName] || 0);
};

/**
 * Prints a message to the console
 */
exports.print = function () {
	if (arguments.length === 1 && Array.isArray(arguments[0])) {
		console.log(format(arguments[0].join('\n')));
	}
	else {
		console.log(format.apply(null, arguments));
	}
};

/**
 * Logs an error message and exits
 */
exports.die = function () {
	console.error();

	if (arguments.length === 1 && Array.isArray(arguments[0])) {
		console.error(format(arguments[0].join('\n')));
	}
	else {
		console.error(format.apply(null, arguments));
	}

	console.error();
	process.exit(1);
};

/**
 * Returns a function that will print messages to stderr if the verbose parameter is true. The function will do nothing
 * if verbose is false.
 */
exports.getLogger = function (verbose) {
	if (verbose) {
		var util = require('util');
		return function () {
			process.stderr.write('>> ' + util.format.apply(util, arguments) + '\n');
		};
	}
	return function () {};
};

/**
 * Ensures that a value is a number and returns its int value
 */
exports.intArg = function (val) {
	if (isNaN(val)) {
		exports.die('error: expected "' + val + '" to be a number');
	}
	return Number.parseInt(val, 10);
};

/**
 * Returns a formatter function. This function works similarly to Node's `util.format`, but it automatically wraps text
 * at a given width, and prepends a prefix to all lines.
 */
function getFormatter(width, prefix) {
	return function () {
		var util = require('util');
		var message = util.format.apply(util, arguments);
		var messageLines = message.split('\n');
		var lines = [];
		var line = messageLines.shift();
		while (line != null) {
			if (line.length - prefix.length <= width) {
				lines.push(prefix + line);
				line = messageLines.shift();
			}
			else {
				var shortLine = line.slice(0, width - prefix.length);
				var start = shortLine.search(/\S/);
				var space = shortLine.lastIndexOf(' ');
				if (space === -1 || space < start) {
					space = line.indexOf(' ', start);
				}

				if (space !== -1) {
					lines.push(prefix + line.slice(0, space));
					line = line.slice(space + 1);
				}
				else {
					lines.push(prefix + line);
					line = messageLines.shift();
				}
			}
		}

		return lines.join('\n');
	};
}

/**
 * Formats a string. This function is initially a stub that replaces itself with a formatter function the first time
 * it's called.
 */
var format = function () {
	var formatter = getFormatter(80, '  ');
	format = formatter;
	return formatter.apply(null, arguments);
};

