var shell = require('shelljs');
shell.rm('-rf', 'dist');
shell.rm('-f', 'tenon*.json');
shell.rm('-f', 'tenon*.html');
shell.rm('-f', 'axe*.json');
shell.rm('-f', 'axe*.html');
