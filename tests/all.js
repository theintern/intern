define([
	'./main',
	'./order',
	'./lib/Suite',
	'./lib/Test',
	'./lib/args',
	'./lib/reporterManager',
	'./lib/interfaces/tdd',
	'./lib/interfaces/bdd',
	'./lib/interfaces/object',
	'./lib/reporters/console',
	'./lib/reporters/json',
	'dojo/has!host-node?./lib/reporters/teamcity',
	'dojo/has!host-node?./lib/reporters/lcov'
], function () {});
