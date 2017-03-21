/*jshint node:true */
var fs = require('fs');
var path = require('path');
var browserModules = path.join(__dirname, '..', 'browser_modules');

function getPackageVersion(packageJsonPath) {
	var packageJson = fs.readFileSync(packageJsonPath, { encoding: 'utf8' });
	return JSON.parse(packageJson).version;
}

if (!fs.existsSync(browserModules)) {
	fs.mkdirSync(browserModules);
}

// AMD-loaded dependencies need to exist in a known location, but npm's deduplication process can make final package
// locations unpredictable, so copy the currently installed versions of required packages into browser_modules.
[ 'dojo', 'chai', 'diff', 'benchmark', 'lodash-amd', 'platform' ].forEach(function (dependency) {
	var packageJson = require.resolve(path.join(dependency, 'package.json'));
	var installedPath = path.dirname(packageJson);
	var expectedPath = path.join(browserModules, dependency);
	var installedVersion = getPackageVersion(packageJson);
	var existingVersion;

	try {
		existingVersion = getPackageVersion(path.join(expectedPath, 'package.json'));
	}
	catch (error) {
		if (error.code !== 'ENOENT') {
			throw error;
		}
	}

	// The package in browser_modules is older than the installed version; delete it
	if (existingVersion && existingVersion !== installedVersion) {
		unlink(expectedPath);
		existingVersion = null;
	}

	// The package isn't in browser_modules, so copy the installed one
	if (!existingVersion) {
		copy(installedPath, expectedPath);
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

function unlink(target) {
	try {
		var stats = fs.statSync(target);
	}
	catch (error) {
		if (error.code !== 'ENOENT') {
			throw error;
		}

		return;
	}

	if (stats.isDirectory()) {
		fs.readdirSync(target).forEach(function (filename) {
			unlink(path.join(target, filename));
		});
		fs.rmdirSync(target);
	}
	else if (stats.isFile()) {
		fs.unlinkSync(target);
	}
}
