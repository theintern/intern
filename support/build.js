var shell = require('shelljs');
var path = require('path');
var glob = require('glob');
var buildDir = 'dist';

shell.exec('node ./node_modules/.bin/tsc');
glob.sync('tests/**/*.{html,json}').forEach(function (resource) {
	var dst = path.join(buildDir, resource);
	var dstDir = path.dirname(dst);
	if (!shell.test('-d', dstDir)) {
		shell.mkdir(dstDir);
	}
	shell.cp(resource, dst);
});
