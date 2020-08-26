/**
 * Sync versions of dependencies in packages
 *
 * Given a dependency, this script will find the version installed in all
 * repo packages and either update it to the highest version amongst the
 * packages (by default) or to a specified version.
 */

import { loadPackageJsons, savePackageJson } from './lib/pkg';

const args = process.argv.slice(2);
let depProperty: 'dependencies' | 'devDependencies' = 'dependencies';
let name: string | undefined;
let version: string | undefined;

for (const arg of args) {
  if (arg === '-h' || name === '--help') {
    printHelp();
    process.exit(0);
  } else if (arg === '-d') {
    depProperty = 'devDependencies';
  } else if (name == null) {
    name = arg;
  } else if (version == null) {
    version = arg;
  } else {
    printHelp();
    process.exit(1);
  }
}

const packageJsons = loadPackageJsons();

if (!name) {
  const dependents: { [dep: string]: string[] } = {};
  for (const pkg of Object.keys(packageJsons)) {
    const pkgInfo = packageJsons[pkg];
    for (const dep of Object.keys(pkgInfo.data[depProperty])) {
      dependents[dep] = [...(dependents[dep] ?? []), pkg];
    }
  }

  const sharedDependencies = Object.keys(dependents)
    .filter(dep => dependents[dep].length > 1)
    .filter(dep => {
      const versions = Object.keys(packageJsons)
        .map(pkg => packageJsons[pkg].data[depProperty][dep])
        .filter(ver => ver != null);
      const versionSet = new Set(versions);
      return versionSet.size > 1;
    });

  if (sharedDependencies.length > 0) {
    for (const dep of sharedDependencies) {
      console.log(dep);
    }
  }
} else {
  const pkgsWithDep = Object.keys(packageJsons).filter(
    pkg => packageJsons[pkg].data[depProperty]?.[name as string] != null
  );

  if (!version) {
    const versions = [];
    let maxLen = 0;

    for (const pkg of pkgsWithDep) {
      const pkgVer = packageJsons[pkg].data[depProperty][name];
      versions.push([pkg, pkgVer]);
      maxLen = Math.max(pkg.length, maxLen);
    }

    for (const ver of versions) {
      console.log(`${`${ver[0]}`.padEnd(maxLen, ' ')}  ${ver[1]}`);
    }
  } else {
    for (const pkg of pkgsWithDep) {
      const pkgInfo = packageJsons[pkg];
      const currentVersion = pkgInfo.data[depProperty][name];
      if (currentVersion !== version) {
        pkgInfo.data[depProperty][name] = version;
        savePackageJson(pkgInfo);
        console.log(`Updated ${name} in ${pkgInfo.data.name} to ${version}`);
      }
    }
  }
}

function printHelp() {
  console.log('USAGE');
  console.log('  dev-syncdeps [-d] [DEPENDENCY [VERSION]]');
  console.log();
  console.log('DESCRIPTION');
  console.log('  With no arguments, print a list of all dependencies');
  console.log('  used by multiple packages where different versions');
  console.log('  of the dependency are used.');
  console.log();
  console.log('  With a DEPENDENCY, list the dependency version in all');
  console.log('  packages that use it.');
  console.log();
  console.log('  With a DEPENDENCY and VERSION, set the dependency to the');
  console.log('  given version in all packages that use it.');
  console.log();
  console.log('  The -d option toggles the use of devDependencies rather');
  console.log('  than dependencies.');
  console.log();
}
