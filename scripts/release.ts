#!/usr/bin/env node

//
// This script creates and publishes new release of a project. The basic
// process is:
//
//   1. Create a temporary clone of the repo. All work will be done from the
//      clone.
//   2. Update the source for the version being released, commit, and tag.
//   3. Update the source for the new version, and commit that.
//   4. Checkout the tagged version.
//   5. Build it.
//   6. Give the user a chance to review, then publish
//   7. Push the new commits and tag back to the original repo.
//

import execa from 'execa';
import { echo, mkdir, rm, test } from 'shelljs';
import * as semver from 'semver';
import { readFileSync, writeFileSync } from 'fs';
import { format } from 'util';
import { log } from './lib/util';
import { createInterface } from 'readline';
import chalk from 'chalk';
import { spawnSync } from 'child_process';

(async function main() {
  function cleanup() {
    log('Cleaning up...');
    process.chdir(rootDir);
    rm('-rf', tmpDir);
  }

  function printUsage() {
    echo(
      `
    Usage: intern-dev-release [help] [b=branch] [v=version] [p=prerelease] [t=tag]

    help        Displays this message
    branch      Branch to release; defaults to the current branch
    tag         dist-tag to use when publishing; defaults to "latest"
    version     Version to release; defaults to what is listed in the
                package.json in the branch. It should only be specified
                for pre-releases
    prerelease  A prerelease tag to attach to the version, like "alpha"
                beta
    `.trim()
    );
  }

  async function prompt(...args: any[]) {
    const question = format(args[0], ...args.slice(1));
    return new Promise<string>(function(resolve) {
      rl.question(question, resolve);
    });
  }

  function loadPackageJson() {
    return JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));
  }

  function updatePackageVersion(version: string) {
    const packageJson = loadPackageJson();
    packageJson.version = version;
    writeFileSync('package.json', JSON.stringify(packageJson, null, '  '));
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let { stdout: branch } = await execa('git', [
    'rev-parse',
    '--abbrev-ref',
    'HEAD'
  ]);
  // the version to be released
  let version: string;
  // the tag that will be applied to the package in the npm registry
  let npmTag: string | undefined;
  // the next pre-release version that will be set on the original branch after
  // tagging
  let preVersion: string;
  // a prerelease tag to attach to the version
  let preTag: string | undefined;
  // the name of the new release branch that should be created if this is not a
  // patch release
  let newBranch: string | undefined;
  // the pre-release version that will be set on the minor release branch
  let branchVersion: string | undefined;

  // the version provided by the user
  let userVersion: string | undefined;

  for (const arg of process.argv.slice(2)) {
    if (arg === 'help') {
      printUsage();
      process.exit(0);
    }

    const [key, value] = arg.split('=', 2);
    switch (key) {
      case 'b':
        branch = value;
        break;

      case 'v':
        userVersion = value;
        break;

      case 't':
        npmTag = value;
        break;

      case 'p':
        preTag = value;
        break;

      default:
        echo(`Invalid argument "${arg}"\n\n`);
        printUsage();
        process.exit(1);
    }
  }

  const rootDir = process.cwd();
  const tmpDir = '_publish';
  let exitCode = 0;
  const pushBranches = [branch];

  if (!npmTag) {
    if (preTag || userVersion) {
      // If a prerelease tag or custom version were specified, this will be
      // the 'next' version
      npmTag = 'next';
    } else {
      // If a custom version wasn't specified, this will be the latest
      // version
      npmTag = 'latest';
    }
  }

  (async function main() {
    try {
      if (branch !== 'master') {
        const question =
          `Are you sure you want to create a release from branch ${branch}?\n` +
          'Enter "y" to continue, any other key to abort.\n' +
          '> ';

        if ((await prompt(question)) !== 'y') {
          throw new Error('Aborted');
        }
      }

      let output: string | undefined;
      try {
        ({ stdout: output } = await execa('git', [
          'config',
          'receive.denyCurrentBranch'
        ]));
      } catch {
        // ignore
      }

      if (!output || output.indexOf('updateInstead') !== 0) {
        throw new Error(
          'Repository should have receive.denyCurrentBranch set to "updateInstead"'
        );
      }

      const { stdout: currentBranch } = await execa('git', [
        'rev-parse',
        '--abbrev-ref HEAD'
      ]);
      if (branch === currentBranch) {
        try {
          await execa('git', ['diff-index', '--quiet', 'HEAD']);
        } catch (error) {
          log(chalk.red('Warning: You have uncommitted changes.'));
        }
      }

      let message = `Creating a new release from branch ${branch}`;
      if (userVersion) {
        message += ` with version override ${userVersion}`;
      }
      log(`${message}.`);

      // Create a package build directory and clone this repo into it
      process.chdir(rootDir);
      if (test('-d', tmpDir)) {
        cleanup();
      }
      mkdir(tmpDir);
      await execa('git', ['clone', '--recursive', '.', tmpDir]);

      // Cd into the build dir and checkout the branch that's being released
      process.chdir(tmpDir);
      log(`Building branch "${branch}"...`);
      await execa('git', ['checkout', branch]);

      // Load package JSON from the build directory
      const packageJson = loadPackageJson();

      // Determine the proper version numbers for release and for repo
      // post-release
      if (userVersion) {
        if (semver.gte(packageJson.version, userVersion)) {
          throw new Error('Provided version must be >= current version');
        }
        version = userVersion;
      } else {
        // Use the version from package.json in the currently checked out
        // branch
        version = packageJson.version;

        if (!semver.prerelease(version)) {
          throw new Error(
            'Releases may only be generated from pre-release versions'
          );
        }

        version = `${semver.major(version)}.${semver.minor(
          version
        )}.${semver.patch(version)}`;

        if (preTag) {
          version += `-${preTag}`;

          // Get all the x.y.z-preTag.w versions
          let tagLines: string[] | undefined;
          try {
            const { stdout } = await execa('git', [
              'show-ref',
              '--tags',
              '--abbrev'
            ]);
            tagLines = stdout.split('\n');
          } catch (error) {
            // No existing tags
            tagLines = [];
          }
          const tags = tagLines.map(line => /refs\/tags\/(.*)/.exec(line)![1]);
          const sameVersionTags = tags.filter(tag => {
            try {
              return (
                semver.major(tag) === semver.major(version) &&
                semver.minor(tag) === semver.minor(version) &&
                semver.patch(tag) === semver.patch(version) &&
                semver.prerelease(tag)![0] === preTag
              );
            } catch (error) {
              return false;
            }
          });
          sameVersionTags.sort((a, b) => {
            const preA = Number(semver.prerelease(a)![1]);
            const preB = Number(semver.prerelease(b)![1]);
            return preB - preA;
          });

          // Increment the latest x.y.z-preTag.w version _or_ the current
          // version
          version = semver.inc(
            sameVersionTags[0] || version,
            'prerelease',
            <any>preTag
          )!;
        }
      }

      // Check that the version hasn't already been tagged
      const { stdout: tags } = await execa('git', ['tag']);
      for (const tag of tags.split('\n')) {
        if (tag === version) {
          throw new Error('Version ' + tag + ' has already been tagged');
        }
      }

      // Pre-release or non-branching updates
      if (
        semver.major(version) === 0 ||
        semver.patch(version) !== 0 ||
        semver.prerelease(version)
      ) {
        preVersion = semver.inc(version, 'patch') + '-pre';
      } else {
        // If the patch digit is a 0, this is a new major/minor release
        // The new branch we'll be making for this major/minor release
        newBranch = `${semver.major(version)}.${semver.minor(version)}`;

        // The full version of the next release in the new branch
        branchVersion = semver.inc(version, 'patch') + '-pre';

        // The next version on master is usually going to be a minor
        // release; if the next version is to be a major release, the
        // package version will need to be manually updated in Git before
        // release e.g., current is
        // 2.1.0, pre will be 2.2.0-pre
        preVersion = semver.inc(version, 'minor') + '-pre';
      }

      // Set the package version to release version and commit the new release
      updatePackageVersion(version);
      await execa('git', [
        'commit',
        '-m',
        `Updating metadata for ${version}`,
        'package.json'
      ]);
      await execa('git', ['tag', '-a', '-m', `Release ${version}`, version]);

      // Check out the previous package.json
      await execa('git', ['checkout', 'HEAD^', 'package.json']);
      await execa('git', ['reset', 'package.json']);

      // Set the package version to next pre-release version and commit the
      // pre-release
      updatePackageVersion(preVersion);
      await execa('git', [
        'commit',
        '-m',
        `Updating source version to ${preVersion}`,
        'package.json'
      ]);

      // If this is a major/minor release, we also create a new branch for it
      if (newBranch && branchVersion) {
        log(`Creating new branch ${newBranch}...`);
        // Create the new branch starting at the tagged release version
        await execa('git', ['checkout', '-b', newBranch, version]);

        // Set the package version to the next patch pre-release version
        // and commit the pre-release
        updatePackageVersion(branchVersion);
        await execa('git', [
          'commit',
          '-m',
          `Updating source version to ${branchVersion}`,
          'package.json'
        ]);

        // Store the branch as one that needs to be pushed when we are
        // ready to deploy the release
        pushBranches.push(newBranch);
      }

      // Checkout and build the new release in preparation for publishing
      log(`Checking out and building ${version}...`);
      await execa('git', ['checkout', version]);
      await execa('npm', ['install']);
      await execa('npm', ['run', 'build']);

      // Give the user a chance to verify everything is good before making any updates
      log('Done!');

      const publishDir = '_build';
      log(`Package to be published from ${tmpDir}/${publishDir}.`);

      const question =
        'Please confirm packaging success, then enter "y" to publish to npm\n' +
        `'${npmTag}', push tag '${version}', and upload. Enter any other key to bail.\n` +
        '> ';

      if ((await prompt(question)) !== 'y') {
        log('Not publishing');
        throw new Error('Aborted');
      }

      // Publish the package from <rootDir>/<tmpDir>/<publishDir> or
      // <rootDir>/<tmpDir>/<buildDir>
      process.chdir(publishDir);

      // Publish using spawn and inheriting stdio so user can supply OTP if
      // 2-factor auth is enabled
      const pubResult = spawnSync(
        'npm',
        [
          'publish',
          '--tag',
          npmTag,
          '--access',
          'public',
          '--registry',
          'https://registry.npmjs.org'
        ],
        {
          stdio: 'inherit'
        }
      );
      if (pubResult.error) {
        throw pubResult.error;
      } else if (pubResult.status !== 0) {
        throw new Error(`npm publish failed: ${pubResult.status}`);
      }

      // Update the original repo with the new branch and tag pointers
      for (const branch of pushBranches) {
        await execa('git', ['push', 'origin', branch]);
      }
      await execa('git', ['push', 'origin', '--tags']);

      // Push the new commit and tags to the main repo
      process.chdir(rootDir);
      let remote: string | undefined;
      const { stdout: remotes } = await execa('git', ['remote', '-v']);
      for (const line of remotes.split(/\n/)) {
        if (/github.com:theintern\/.*\(push\)/.test(line)) {
          remote = line.split('\t')[0];
          break;
        }
      }
      if (!remote) {
        log('No origin remote; not pushing');
      } else {
        await execa('git', ['push', remote]);
        await execa('git', ['push', remote, '--tags']);
      }

      log('All done! Yay!');
    } catch (error) {
      if (error.message !== 'Aborted') {
        // Something broke -- display an error
        log(`${chalk.red(error.stack)}`);
        log('Aborted.');
        exitCode = 1;
      }
    } finally {
      if (exitCode !== 1) {
        cleanup();
      }

      process.exit(exitCode);
    }
  })();
})();
