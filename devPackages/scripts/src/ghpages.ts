// Publish assets to gh-pages

import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { cp, mkdir, rm, exec, set } from 'shelljs';
import { ask, init, isYesNo, print, stop } from './lib/rl';

set('-e');

const ghpagesDir = '_ghpages';
const projectRoot = resolve(__dirname, '..', '..', '..');
process.chdir(projectRoot);

function getInternVersion() {
  const packageData = readFileSync(
    join(projectRoot, 'packages', 'intern', 'package.json'),
    { encoding: 'utf8' }
  );
  const packageJson = JSON.parse(packageData);
  return packageJson.version.split('.')[0];
}

function updateGhPages() {
  // Create a package build directory and clone this repo into it
  exec('git fetch origin gh-pages:gh-pages');
  exec(`git clone . "${ghpagesDir}"`);

  process.chdir(ghpagesDir);
  try {
    exec('git checkout gh-pages');

    const version = getInternVersion();
    const resources = join('resources', version);
    mkdir('-p', resources);

    const wdDest = resources;
    const schemaDest = join(resources, 'schemas');

    cp('../packages/digdug/src/webdrivers.json', wdDest);
    cp('-r', '../packages/core/schemas/config.json', schemaDest);
    cp('-r', '../packages/digdug/schemas/webdrivers.json', schemaDest);

    exec(`git add "${resources}"`);
    exec('git commit -m "Update assets"');
  } finally {
    process.chdir(projectRoot);
  }
}

function publishGhPages() {
  process.chdir(ghpagesDir);

  try {
    exec('git push');
    process.chdir(projectRoot);
    exec('git push origin gh-pages');
  } finally {
    process.chdir(projectRoot);
  }
}

async function main() {
  init();

  print(`Updating gh-pages in ${ghpagesDir}...`);
  updateGhPages();

  const answer = await ask('Publish updated gh-pages [yN]? ', isYesNo);
  if (answer.toLowerCase() === 'y') {
    publishGhPages();
  }

  print('Cleaning up...');
  rm('-rf', ghpagesDir);
}

main()
  .catch(error => console.error(error))
  .finally(() => stop())
  .finally(() => print('Done'));
