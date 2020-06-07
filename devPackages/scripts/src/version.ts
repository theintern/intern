import { sync as glob } from 'glob';
import { readFileSync, writeFileSync } from 'fs';
import { gt } from 'semver';

interface PackageJson {
  name: string;
  version: string;
  dependencies: { [name: string]: string };
}

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

const packageFiles = glob('packages/**/package.json', {
  ignore: '**/node_modules/**'
});

const packages: {
  [name: string]: { data: PackageJson; file: string };
} = {};

for (const pkg of packageFiles) {
  const data = readFileSync(pkg, { encoding: 'utf8' });
  const pkgJson = JSON.parse(data) as PackageJson;
  packages[pkgJson.name] = { data: pkgJson, file: pkg };
}

if (version && !force) {
  for (const name in packages) {
    const pkgVersion = packages[name].data.version;
    if (gt(pkgVersion, version)) {
      console.error(`${name}@${pkgVersion} is newer than ${version}`);
      process.exit(1);
    }
  }
}

for (const name in packages) {
  const pkg = packages[name];
  if (!version) {
    console.log(`${name} => ${pkg.data.version}`);
  } else {
    pkg.data.version = version;
    const deps = pkg.data.dependencies as Record<string, string>;
    for (const dep in deps) {
      if (dep in packages) {
        const depVal = deps[dep];
        deps[dep] = depVal.replace(/\d+\..*/, version);
      }
    }
    writeFileSync(pkg.file, `${JSON.stringify(pkg.data, null, '  ')}\n`);
    console.log(`${name} => ${version}`);
  }
}
