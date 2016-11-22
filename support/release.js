var shell = require('shelljs');
var semver = require('semver');
var fs = require('fs');
var path = require('path');
var util = require('util');
var tsconfig = require(path.join(rootDir, 'tsconfig.json'));
var readline = require('readline');

function cleanup() {
	print('\nCleaning up...\n');
	process.chdir(rootDir);
	shell.rm('-rf', buildDir);
}

function print() {
	rl.write(util.format.apply(util, arguments));
}

function printUsage() {
	print('Usage: %s [--help] [branch [version]]\n', process.argv[1]);
	print('\n');
	print('<branch> defaults to "master".\n');
	print('<version> is the version to release, and defaults to what is listed in the\n');
	print('  package.json in the branch. It should only be specified for pre-releases\n');
}

function prompt() {
	var question = util.format.apply(util, arguments);
	return new Promise(function (resolve) {
		rl.question(question, resolve);
	});
}

function run(cmd) {
	return new Promise(function (resolve, reject) {
		shell.exec(cmd, { silent: true }, function (error, stdout, stderr) {
			if (error) {
				reject(new Error(stderr));
			}
			else {
				resolve(stdout);
			}
		});
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
var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

if (args[0] === '--help') {
	printUsage();
	process.exit(0);
}

var rootDir = path.dirname(__dirname);
var buildDir = tsconfig.compilerOptions.outDir;
var branch = args[0] || 'master';
var pushBranches = [ branch ];
var npmTag = 'latest';
var exitCode = 0;

// the version to be released
var version;
// the next pre-release version that will be set on the original branch after tagging
var preVersion;
// the name of the new release branch that should be created if this is not a patch release
var newBranch;
// the pre-release version that will be set on the minor release branch
var branchVersion;

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
	// Create a package build directory and clone this repo into it
	process.chdir(rootDir);
	if (shell.test('-d', buildDir)) {
		throw new Error('Existing build directory detected at ' + buildDir);
	}
	shell.mkdir(buildDir);
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
		// Use the version from package.json in the currently checked out branch
		version = packageJson.version;

		if (!semver.prerelease(version)) {
			throw new Error('Releases may only be generated from pre-release versions');
		}

		version = semver.major(version) + '.' + semver.minor(version) + '.' + semver.patch(version);
	}
	else {
		if (semver.gte(version, packageJson.version)) {
			throw new Error('Provided version must be >= current version');
		}
	}

	// Check that the version hasn't already been tagged
	return run('git tag').then(function (tags) {
		tags.split('\n').forEach(function (tag) {
			if (tag === version) {
				throw new Error('Version ' + tag + ' has already been tagged');
			}
		});
	});
}).then(function () {
	// Pre-release or non-branching updates
	if (semver.major(version) === 0 || semver.patch(version) !== 0) {
		preVersion = semver.inc(version, 'patch') + '-pre';
	}
	// If the patch digit is a 0, this is a new major/minor release
	else {
		// The new branch we'll be making for this major/minor release
		newBranch = util.format('%s.%s', semver.major(version), semver.minor(version));

		// The full version of the next release in the new branch
		branchVersion = semver.inc(version, 'patch') + '-pre';

		// The next version on master is usually going to be a minor release; if the next version is to be a major
		// release, the package version will need to be manually updated in Git before release e.g., current is
		// 2.1.0, pre will be 2.2.0-pre
		preVersion = semver.inc(version, 'minor') + '-pre';
	}
}).then(function () {
	// Set the package version to release version and commit the new release
	updatePackageVersion(version);
	return run('git commit -m "Updating metadata for ' + version + '" package.json').then(function () {
		return run('git tag -a -m "Release ' + version + '" ' + version);
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
	if (newBranch) {
		print('Creating new branch %s...\n', newBranch);
		// Create the new branch starting at the tagged release version
		return run('git checkout -b ' + newBranch + ' ' + version).then(function () {
			// Set the package version to the next patch pre-release version and commit the pre-release
			updatePackageVersion(branchVersion);
			return run('git commit -m "Updating source version to ' + branchVersion + '" package.json');
		}).then(function () {
			// Store the branch as one that needs to be pushed when we are ready to deploy the release
			pushBranches.push(newBranch);
		});
	}
}).then(function () {
	// Checkout and build the new release in preparation for publishing
	print('Checking out and building %s...\n', version);
	return run('git checkout ' + version).then(function () {
		return run('npm install');
	}).then(function () {
		return run('node ./support/build.js dist');
	});
}).then(function () {
	// Give the user a chance to verify everything is good before making any updates
	print('\nDone!\n\n');

	var question = 'Please confirm packaging success, then enter "y" to publish to npm\n' +
		npmTag + ', push tags ' + version + ', and upload. Enter any other key to bail.\n' +
		'> ';

	return prompt(question).then(function (answer) {
		if (answer !== 'y') {
			throw new Error('Aborted');
		}
	});
}).then(function () {
	// Publish the package
	process.chdir(buildDir);
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
}).catch(function (error) {
	if (error.message !== 'Aborted') {
		// Something broke -- display an error
		print(error + '\n');
		print('Aborted.\n');
		exitCode = 1;
	}
}).then(function () {
	process.exit(exitCode);
});
