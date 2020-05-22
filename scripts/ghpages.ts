// Publish assets to gh-pages

import * as execa from 'execa';
import { join, resolve } from 'path';
import { cp, mkdir, rm } from 'shelljs';
import * as packageJson from '../package.json';
import { ask, init, isYesNo, print, stop } from './lib/rl';

const ghpagesDir = '_ghpages';
const projectRoot = resolve(__dirname, '..');
process.chdir(projectRoot);

function getInternVersion() {
  return packageJson.version.split('.')[0];
}

async function updateGhPages() {
  // Create a package build directory and clone this repo into it
  await execa('git', ['clone', '.', ghpagesDir]);

  process.chdir(ghpagesDir);
  try {
    await execa('git', ['checkout', 'gh-pages']);

    const version = getInternVersion();
    const resources = join('resources', version);
    mkdir('-p', resources);

    cp('../src/webdrivers.json', resources);
    cp('-r', '../src/schemas', resources);

    await execa('git', ['add', resources]);
    await execa('git', ['commit', '-m', 'Update assets']);
  } finally {
    process.chdir(projectRoot);
  }
}

async function publishGhPages() {
  process.chdir(ghpagesDir);

  try {
    await execa('git', ['push']);
    process.chdir(projectRoot);
    await execa('git', ['push', 'origin', 'gh-pages']);
  } finally {
    process.chdir(projectRoot);
  }
}

async function main() {
  init();

  print(`Updating gh-pages in ${ghpagesDir}...`);
  await updateGhPages();

  const answer = await ask('Publish updated gh-pages [yN]? ', isYesNo);
  if (answer.toLowerCase() === 'y') {
    await publishGhPages();
  }

  print('Cleaning up...');
  rm('-rf', ghpagesDir);
}

main()
  .catch(error => console.error(error))
  .finally(() => stop())
  .finally(() => print('Done'));
