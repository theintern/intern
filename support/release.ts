import { mkdir, rm, test } from 'shelljs';
import * as semver from 'semver';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { buildDir, exec } from './common';
import * as readline from 'readline';

function cleanup() {
	print('\nCleaning up...\n');
	process.chdir(rootDir);
	rm('-rf', buildDir);
}

function print(...args: any[]) {
	rl.write(util.format.apply(util, args));
}

function printUsage() {
	print('Usage: %s [--help] [branch [version]]\n', process.argv[1]);
	print('\n');
	print('<branch> defaults to "master".\n');
	print('<version> is the version to release, and defaults to what is listed in the\n');
	print('  package.json in the branch. It should only be specified for pre-releases\n');
}

async function prompt(...args: any[]) {
	const question = util.format.apply(util, args);
	return new Promise<string>(function (resolve) {
		rl.question(question, resolve);
	});
}

function loadPackageJson() {
	return JSON.parse(fs.readFileSync('package.json', { encoding: 'utf8' }));
}

function updatePackageVersion(version: string) {
	const packageJson = loadPackageJson();
	packageJson.version = version;
	fs.writeFileSync('package.json', JSON.stringify(packageJson, null, '  '));
}

const args = process.argv.slice(2);
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

if (args[0] === '--help') {
	printUsage();
	process.exit(0);
}

const rootDir = path.dirname(__dirname);
const branch = args[0] || 'master';
let pushBranches = [ branch ];
let npmTag = 'latest';
let exitCode = 0;

// the version to be released
let version: string;
// the next pre-release version that will be set on the original branch after tagging
let preVersion: string;
// the name of the new release branch that should be created if this is not a patch release
let newBranch: string;
// the pre-release version that will be set on the minor release branch
let branchVersion: string;

if (args[1]) {
	version = args[1];
	npmTag = 'beta';
}

print('This is an internal release script!\n');

async function main() {
	const output = exec('git config receive.denyCurrentBranch').stdout;
	if (output.indexOf('updateInstead') !== 0) {
		throw new Error('Repository should have receive.denyCurrentBranch set to "updateInstead"');
	}

	let question = 'Enter "y" to create a new release from branch ' + branch +
		(version ? (' with version override ' + version) : '.') +
		'\n(You can abort pushing upstream later on if something goes wrong.)\n';

	if (await prompt(question) !== 'y') {
		throw new Error('Aborted');
	}

	// Create a package build directory and clone this repo into it
	process.chdir(rootDir);
	if (test('-d', buildDir)) {
		throw new Error('Existing build directory detected at ' + buildDir);
	}
	mkdir(buildDir);
	exec(`git clone --recursive . ${buildDir}`);

	// Cd into the build dir and checkout the branch that's being released
	process.chdir(buildDir);
	print('\nBuilding branch "%s"...\n', branch);
	exec(`git checkout ${branch}`);

	// Load package JSON from the build directory
	const packageJson = loadPackageJson();

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
	const tags = exec('git tag').stdout;
	tags.split('\n').forEach(function (tag) {
		if (tag === version) {
			throw new Error('Version ' + tag + ' has already been tagged');
		}
	});

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

	// Set the package version to release version and commit the new release
	updatePackageVersion(version);
	exec(`git commit -m "Updating metadata for ${version}" package.json`);
	exec(`git tag -a -m "Release ${version}" ${version}`);

	// Check out the previous package.json
	exec('git checkout HEAD^ package.json');
	exec('git reset package.json');

	// Set the package version to next pre-release version and commit the pre-release
	updatePackageVersion(preVersion);
	exec(`git commit -m "Updating source version to ${preVersion}" package.json`);

	// If this is a major/minor release, we also create a new branch for it
	if (newBranch) {
		print('Creating new branch %s...\n', newBranch);
		// Create the new branch starting at the tagged release version
		exec(`git checkout -b ${newBranch} ${version}`);

		// Set the package version to the next patch pre-release version and commit the pre-release
		updatePackageVersion(branchVersion);
		exec(`git commit -m "Updating source version to ${branchVersion}" package.json`);

		// Store the branch as one that needs to be pushed when we are ready to deploy the release
		pushBranches.push(newBranch);
	}

	// Checkout and build the new release in preparation for publishing
	print('Checking out and building %s...\n', version);
	exec(`git checkout ${version}`);
	exec('npm install');
	exec('npm run build dist');

	// Give the user a chance to verify everything is good before making any updates
	print('\nDone!\n\n');

	question = 'Please confirm packaging success, then enter "y" to publish to npm\n' +
		npmTag + ', push tags ' + version + ', and upload. Enter any other key to bail.\n' +
		'> ';

	if (await prompt(question) !== 'y') {
		throw new Error('Aborted');
	}

	// Publish the package
	process.chdir(buildDir);
	exec(`npm publish --tag ${npmTag}`);

	// Update the original repo with the new branch and tag pointers
	pushBranches.map(function (branch) {
		exec(`git push origin ${branch}`);
	});
	exec('git push origin --tags');

	print('\nAll done! Yay!\n');
}

main().catch(function (error) {
	if (error.message !== 'Aborted') {
		// Something broke -- display an error
		print(error + '\n');
		print('Aborted.\n');
		exitCode = 1;
	}
}).then(function () {
	if (exitCode !== 1) {
		cleanup();
	}

	process.exit(exitCode);
});
