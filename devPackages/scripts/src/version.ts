/**
 * Sync versions of packages in packages/
 */

import { writeFileSync } from 'fs';
import { gt } from 'semver';
import { loadPackageJsons } from './lib/pkg';

const args = process.argv.slice(2);
let version: string | undefined;
let force = false;

for (const arg of args) {
  if (arg === '-f' || arg === '--force') {
    force = true;
  } else {
    version = arg;
  }
}

const packageJsons = loadPackageJsons();

if (version && !force) {
  for (const name in packageJsons) {
    const pkgVersion = packageJsons[name].data.version;
    if (gt(pkgVersion, version)) {
      console.error(`${name}@${pkgVersion} is newer than ${version}`);
      process.exit(1);
    }
  }
}

for (const name in packageJsons) {
  const pkg = packageJsons[name];
  if (!version) {
    console.log(`${name} => ${pkg.data.version}`);
  } else {
    pkg.data.version = version;
    const deps = pkg.data.dependencies as Record<string, string>;
    for (const dep in deps) {
      if (dep in packageJsons) {
        const depVal = deps[dep];
        deps[dep] = depVal.replace(/\d+\..*/, version);
      }
    }
    writeFileSync(pkg.file, `${JSON.stringify(pkg.data, null, '  ')}\n`);
    console.log(`${name} => ${version}`);
  }
}
