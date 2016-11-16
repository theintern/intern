#!/usr/bin/env node

/* global Promise */

var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');
var util = require('util');
var rl = require('readline').createInterface({
	input: process.stdin,
	output: process.stdout
});

function cleanup() {
	// Cleanup
	function rm(filename) {
		if (fs.statSync(filename).isFile()) {
			fs.unlinkSync(filename);
		}
		else {
			fs.readdirSync(filename).forEach(function (entry) {
				rm(path.join(filename, entry));
			});
			fs.rmdirSync(filename);
		}
	}

	print('\nCleaning up...\n');
	process.chdir(rootDir);
	rm(buildDir);
}

function print() {
	rl.write(util.format.apply(util, arguments));
}

function printUsage() {
	print('Usage: %s [options] [branch] [version]\n', process.argv[1]);
	print('\n');
	print('Branch defaults to "master".\n');
	print('Version defaults to what is listed in package.json in the branch.\n');
	print('Version should only be specified for pre-releases.\n');
}

function prompt() {
	var question = util.format.apply(util, arguments);
	return new Promise(function (resolve) {
		rl.question(question, resolve);
	});
}

function run(cmd) {
	return new Promise(function (resolve, reject) {
		if (shouldRun) {
			exec(cmd, function (error, stdout) {
				if (error) {
					reject(error);
				}
				else {
					resolve(stdout);
				}
			});
		}
		else {
			print(cmd + '\n');
			resolve('');
		}
	});
}

function loadPackageJson() {
	return JSON.parse(fs.readFileSync('package.json', { encoding: 'utf8' }));
}

function updatePackageVersion(version) {
	var packageJson = loadPackageJson();
	packageJson.version = version;
	fs.writeFileSync('package.json', JSON.stringify(packageJson, null, '  '));
}

var args = process.argv.slice(2);
var shouldRun = true;

if (args[0] === '--help') {
	printUsage();
	process.exit(0);
}

if (args[0] === '-n') {
	shouldRun = false;
	args.shift();
}

var rootDir = path.dirname(__dirname);
var buildDir = path.join(rootDir, '_build');
var branch = args[0] || 'master';
var pushBranches = [ branch ];
var npmTag = 'latest';
var version;
var releaseTag;
var makeBranch;
var preVersion;
var branchVersion;
var tagVersion;

if (args[1]) {
	version = args[1];
	npmTag = 'beta';
}

print('This is an internal release script!\n');

run('git config receive.denyCurrentBranch').then(
	function (stdout) {
		if (stdout.indexOf('updateInstead') !== 0) {
			throw new Error('Repository should have receive.denyCurrentBranch set to "updateInstead"');
		}
	},
	function () {
		throw new Error('Repository should have receive.denyCurrentBranch set to "updateInstead"');
	}
).then(function () {
	var question = 'Enter "y" to create a new release from branch ' + branch +
		(version ? (' with version override ' + version) : '.') +
		'\n(You can abort pushing upstream later on if something goes wrong.)\n';

	return prompt(question).then(function (answer) {
		if (answer !== 'y') {
			throw new Error('Aborted');
		}
	});
}).then(function () {
	try {
		fs.statSync(buildDir);
		throw new Error('Existing build directory detected at ' + buildDir);
	}
	catch (error) {
		// ignore
	}
}).then(function () {
	// Create a package build directory and clone this repo into it
	process.chdir(rootDir);
	fs.mkdirSync(buildDir);
	return run('git clone --recursive . ' + buildDir);
}).then(function () {
	// Cd into the build dir and checkout the branch that's being released
	process.chdir(buildDir);
	print('\nBuilding branch "%s"...\n', branch);
	return run('git checkout ' + branch);
}).then(function () {
	// Load package JSON from the build directory
	var packageJson = loadPackageJson();

	// Determine the proper version numbers for release and for repo post-release
	if (!version) {
		version = packageJson.version.replace('-pre', '');
		preVersion = version.split('.').map(Number);

		// If the last digit is a 0, this is a new major/minor release
		if (preVersion[2] === 0) {
			// We'll be creating a new minor release branch for this version for any future patch releases
			// e.g., current is 2.1.0, branch will be 2.1.1-pre
			branchVersion = util.format('%s.%s.%s-pre', preVersion[0], preVersion[1], preVersion[2] + 1);

			// makeBranch is the new branch we'll be making for this major/minor release
			makeBranch = util.format('%s.%s', preVersion[0], preVersion[1]);

			// The next release is usually going to be a minor release; if the next version is to be a major release,
			// the package version will need to be manually updated in Git before release
			// e.g., current is 2.1.0, pre will be 2.2.0-pre
			preVersion = util.format('%s.%s.0-pre', preVersion[0], preVersion[1] + 1);
		}
		// If the last digit isn't a 0, this is a new patch release
		else {
			// Patch releases do not get a branch, and the next release version will always be another patch version
			// e.g., current is 2.1.0, pre will be 2.1.1-pre
			preVersion = util.format('%s.%s.%s-pre', preVersion[0], preVersion[1], preVersion[2] + 1);
		}
	}
	else {
		preVersion = packageJson.version + '-pre';
	}

	releaseTag = tagVersion = version;

	// At this point:
	//   `version` is the version of the package that is being released;
	//   `tagVersion` is the name that will be used for the Git tag for the release
	//   `preVersion` is the next pre-release version that will be set on the original branch after tagging
	//   `makeBranch` is the name of the new release branch that should be created if this is not a patch release
	//   `branchVersion` is the pre-release version that will be set on the minor release branch

	return run('git tag').then(function (tags) {
		tags.split('\n').forEach(function (tag) {
			if (tag === tagVersion) {
				throw new Error('Version ' + tag + ' has already been tagged');
			}
		});
	});
}).then(function () {
	// Set the package version to release version and commit the new release
	updatePackageVersion(version);
	return run('git commit -m "Updating metadata for ' + version + '" package.json').then(function () {
		return run('git tag -a -m "Release ' + version + '" ' + tagVersion);
	});
}).then(function () {
	// Check out the previous package.json
	return run('git checkout HEAD^ package.json').then(function () {
		return run('git reset package.json');
	});
}).then(function () {
	// Set the package version to next pre-release version and commit the pre-release
	updatePackageVersion(preVersion);
	return run('git commit -m "Updating source version to ' + preVersion + '" package.json');
}).then(function () {
	// If this is a major/minor release, we also create a new branch for it
	if (makeBranch) {
		print('Creating new branch %s...', makeBranch);
		// Create the new branch starting at the tagged release version
		return run('git checkout -b ' + makeBranch + ' ' + tagVersion).then(function () {
			// Set the package version to the next patch pre-release version and commit the pre-release
			updatePackageVersion(branchVersion);
			return run('git commit -m "Updating source version to ' + branchVersion + '" package.json');
		}).then(function () {
			// Store the branch as one that needs to be pushed when we are ready to deploy the release
			pushBranches.push(makeBranch);
		});
	}
}).then(function () {
	// Checkout the new release in preparation for publishing
	return run('git checkout ' + releaseTag);
}).then(function () {
	// Give the user a chance to verify everything is good before making any updates
	print('\nDone!\n\n');

	var question = 'Please confirm packaging success, then enter "y" to publish to npm\n' +
		npmTag + ', push tags ' + releaseTag + ', and upload. Enter any other key to bail.\n' +
		'> ';

	return new Promise(function (resolve) {
		rl.question(question, function (answer) {
			resolve(answer);
		});
	}).then(function (answer) {
		if (answer !== 'y') {
			cleanup();
			process.exit(0);
		}
	});
}).then(function () {
	// Publish the package
	return run('npm publish --tag ' + npmTag);
}).then(function () {
	// Update the original repo with the new branch and tag pointers
	return Promise.all(pushBranches.map(function (branch) {
		return run('git push origin ' + branch);
	})).then(function () {
		return run('git push origin --tags');
	});
}).then(function () {
	cleanup();
	print('\nAll done! Yay!\n');
	process.exit(0);
}).catch(function (error) {
	// Something broke -- display an error
	print(error.message + '\n');
	print('Aborted.\n');
	process.exit(1);
});
