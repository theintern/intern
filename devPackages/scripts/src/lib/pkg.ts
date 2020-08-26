import { sync as glob } from 'glob';
import { readFileSync, writeFileSync } from 'fs';

export interface PackageJson {
  name: string;
  version: string;
  dependencies: { [name: string]: string };
  devDependencies: { [name: string]: string };
}

export interface PackageInfo {
  data: PackageJson;
  file: string;
}

export function loadPackageJsons(): { [name: string]: PackageInfo } {
  const filenames = glob('packages/**/package.json', {
    ignore: '**/node_modules/**'
  });
  const packageJsons: { [name: string]: PackageInfo } = {};

  for (const pkg of filenames) {
    const data = readFileSync(pkg, { encoding: 'utf8' });
    const pkgJson = JSON.parse(data) as PackageJson;
    packageJsons[pkgJson.name] = { data: pkgJson, file: pkg };
  }

  return packageJsons;
}

export function savePackageJson(pkg: PackageInfo): void {
  writeFileSync(pkg.file, `${JSON.stringify(pkg.data, null, '  ')}\n`);
}
