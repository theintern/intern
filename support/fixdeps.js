/*jshint node:true */
var fs = require('fs');
var path = require('path');
var expected = path.join(__dirname, '..', 'browser_modules');

if (!fs.existsSync(expected)) {
	fs.mkdirSync(expected);
}

// AMD-loaded dependencies need to exist in a known location, so they're symlinked from the path resolved by the node
// loader into browser_modules
[ 'dojo', 'chai', 'diff' ].forEach(function (dependency) {
	var expectedPath = path.join(expected, dependency);

	// Reset any existing dependency symlinks in case the location of the deduplicated package has changed
	try {
		if (fs.lstatSync(expectedPath).isSymbolicLink()) {
			fs.unlinkSync(expectedPath);
		}
	}
	catch (error) {
		if (error.code !== 'ENOENT') {
			throw error;
		}
	}

	var actualPath = path.dirname(require.resolve(path.join(dependency, 'package.json')));

	if (actualPath.indexOf(expectedPath) !== 0) {
		try {
			fs.symlinkSync(path.relative(path.dirname(expectedPath), actualPath), expectedPath, 'junction');
		}
		catch (error) {
			console.warn('Symlinking %s to %s failed with %s. Copying instead...', actualPath, expectedPath,
				error.code);
			copy(actualPath, expectedPath);
		}
	}
});

function copy(source, target) {
	try {
		var stats = fs.statSync(source);
	}
	catch (error) {
		if (error.code !== 'ENOENT') {
			throw error;
		}

		return;
	}

	if (stats.isDirectory()) {
		try {
			fs.mkdirSync(target);
		}
		catch (error) {
			if (error.code !== 'EEXIST') {
				throw error;
			}
		}

		fs.readdirSync(source).forEach(function (filename) {
			copy(path.join(source, filename), path.join(target, filename));
		});
	}
	else if (stats.isFile()) {
		fs.writeFileSync(target, fs.readFileSync(source), { mode: stats.mode });
	}
}
