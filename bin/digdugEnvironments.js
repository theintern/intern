#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var digdugPath = path.dirname(require.resolve('digdug/Tunnel'));
var tunnels = fs.readdirSync(digdugPath).filter(function (name) {
	return /[A-Z]\w+Tunnel\.js/.test(name) &&
		name !== 'NullTunnel.js' &&
		name !== 'Tunnel.js' &&
		name !== 'SeleniumTunnel.js';
}).map(function (name) {
	return name.slice(0, name.length - 3);
});

if (process.argv.length !== 3) {
	console.log('usage: environments TUNNEL');
	console.log();
	console.log('Available tunnels:');
	tunnels.forEach(function (tunnel) {
		console.log('  ' + tunnel);
	});
	process.exit(1);
}

var tunnelName = process.argv[2];

if (tunnels.indexOf(tunnelName) === -1) {
	console.log(tunnelName + ' is not a valid tunnel class');
	process.exit(1);
}

var Tunnel = require('../' + tunnelName);
var tunnel = new Tunnel();
tunnel.getEnvironments().then(
	function (environments) {
		environments.forEach(function (environment) {
			console.log(JSON.stringify(environment.intern));
		});
	},
	function (error) {
		console.error(error);
	}
);
