define([
	'./main',
	'./order',
	'./lib/BenchmarkTest',
	'./lib/EnvironmentType',
	'./lib/Suite',
	'./lib/Test',
	'./lib/util',
	'./lib/ReporterManager',
	'./lib/executors/PreExecutor',
	'./lib/interfaces/tdd',
	'./lib/interfaces/bdd',
	'./lib/interfaces/benchmark',
	'./lib/interfaces/object',
	'./lib/interfaces/qunit',
	'./lib/reporters/Console',
	'./lib/resolveEnvironments',

	'dojo/has!host-node?./lib/Proxy',
	'dojo/has!host-node?./lib/reporters/Pretty',
	'dojo/has!host-node?./lib/reporters/TeamCity',
	'dojo/has!host-node?./lib/reporters/JUnit',
	'dojo/has!host-node?./lib/reporters/Lcov',
	'dojo/has!host-node?./lib/reporters/JsonCoverage',

	'dojo/has!host-browser?./lib/reporters/Html'
], function () {});
