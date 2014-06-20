/*jshint node:true */
var fs = require('fs');
var path = require('path');
var expected = path.join(__dirname, '..', 'node_modules');

// AMD-loaded dependencies need to exist in Intern's node_modules directory,
// regardless of whether or not they were deduped by npm
[ 'dojo', 'chai' ].forEach(function (dependency) {
	var expectedPath = path.join(expected, dependency);

	// Reset any existing dependency symlinks in case the location of the
	// deduplicated package has changed
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

	var actualPath = path.dirname(require.resolve(dependency));

	if (actualPath.indexOf(expectedPath) !== 0) {
		fs.symlinkSync(actualPath, expectedPath, 'dir');
	}
});
