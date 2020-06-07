#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

import Tunnel from '../Tunnel';

const digdugPath = path.dirname(__dirname);

const tunnels = fs
  .readdirSync(digdugPath)
  .filter(function(name) {
    return (
      /[A-Z]\w+Tunnel\.js$/.test(name) &&
      name !== 'NullTunnel.js' &&
      name !== 'Tunnel.js' &&
      name !== 'SeleniumTunnel.js'
    );
  })
  .map(function(name) {
    return name.slice(0, name.length - 3);
  });

if (process.argv.length !== 3) {
  console.log('usage: environments TUNNEL');
  console.log();
  console.log('Available tunnels:');
  tunnels.forEach(function(tunnel) {
    console.log('  ' + tunnel);
  });
  process.exit(1);
}

const tunnelName = process.argv[2];

if (tunnels.indexOf(tunnelName) === -1) {
  console.log(tunnelName + ' is not a valid tunnel class');
  process.exit(1);
}

const TunnelCtor: typeof Tunnel = require('../' + tunnelName).default;
const tunnel = new TunnelCtor();
tunnel
  .getEnvironments()
  .then(function(environments) {
    environments.forEach(function(environment) {
      console.log(JSON.stringify(environment.intern));
    });
  })
  .catch(function(error) {
    console.error(error);
  });
