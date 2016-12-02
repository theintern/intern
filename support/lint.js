var shell = require('shelljs');

if (shell.exec('node ./node_modules/.bin/tslint --project tsconfig.json').code) {
	process.exit(1);
}
