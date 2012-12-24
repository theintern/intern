/*global __dirname:false */
if (typeof process !== 'undefined' && typeof define === 'undefined') {
	var req = require('./dojo/dojo');
	// TODO: Fix configuration
	req.set(__dirname + '/', undefined, [ 'dojo', 'istanbul', { name: 'teststack', location: '.' } ]);
	req([ 'teststack/runner' ]);
}
else {
	define([
		'./lib/createInstrumentationServer',
		'dojo/node!./istanbul/lib/instrumenter',
		'dojo/node!fs',
		'dojo/node!path',
		'./lib/args'
	], function (createInstrumentationServer, Instrumenter, fs, path, args) {
		if (!args.port) {
			throw new Error('Required option "port" not specified');
		}

		var instrumenter = new Instrumenter({ noCompact: true, noAutoWrap: true });
		createInstrumentationServer(args.port, instrumenter, '.');
	});
}