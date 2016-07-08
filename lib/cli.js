var exports = module.exports;

/**
 * Ensure Intern version is at least an expected version
 */
exports.acceptVersion = function (internVersion, minVersion, maxVersion) {
	var semver = require('semver');
	internVersion = internVersion.split('-')[0];
	if (!semver.satisfies(internVersion, '>=' + minVersion)) {
		return false;
	}
	if (maxVersion && !semver.satisfies(internVersion, '<=' + maxVersion)) {
		return false;
	}
	return true;
};

/**
 * collect collects values into an array
 */
exports.collect = function (val, arr) {
	arr.push(val);
};

/**
 * copy synchronously copies files or directories
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
 * enumArg ensures a value is part of an enum
 */
exports.enumArg = function (choices, val) {
	if (choices.indexOf(val) === -1) {
		console.error();
		console.error('  error: expected "' + val + '" to be one of {' + choices.join(', ') + '}');
		console.error();
		process.exit(1);
	}
	return val;
};

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

var format = function () {
	var formatter = getFormatter(80, '  ');
	format = formatter;
	return formatter.apply(null, arguments);
};

/**
 * Print a message to the console
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
 * Log an error message and exit
 */
exports.error = function () {
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
 * vlog prints log messages if verbose mode is enabled
 */
exports.getLogger = function (verbose) {
	if (verbose) {
		return function () {
			process.stdout.write('>> ');
			console.log.apply(console, arguments);
		};
	}
	return function () {};
};

/**
 * intArg ensures a value is a number and returns its int value
 */
exports.intArg = function (val) {
	if (isNaN(val)) {
		console.error();
		console.error('  error: expected "' + val + '" to be a number');
		console.error();
		process.exit(1);
	}
	return Number.parseInt(val, 10);
};
