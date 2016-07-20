# intern-cli

> The command line interface for [Intern](https://github.com/theintern/intern)

This module gives Intern a friendly command line interface that works like a typical POSIX application.

## Getting started

Install it globally:

	$ npm install -g intern-cli

You can then run Intern unit tests with:

	$ intern run

intern-cli will use Intern’s Node client by default, and it assumes the test config is located at `./tests/intern.js`.

## Getting help

intern-cli provides top level help when run with no arguments:

	$ intern

	  Usage: intern [options] [command]

	  Run JavaScript tests

	  Commands:

	    init [options]    Setup a project for testing with Intern
	    run [options]     Run tests in Node or in a browser using WebDriver
	    serve [options]   Start a simple web server for running unit tests in a browser on your system

	  Options:

	    -h, --help     output usage information
	    -v, --verbose  show more information about what Intern is doing
	    -V, --version  output the version
	    --debug        enable the Node debugger

You can get more information about a particular sub-command with the `help` command or the `-h` option:

	$ intern help init

	  Usage: init [options]

	  Setup a project for testing with Intern

	  Options:

		-h, --help               output usage information
		-b, --browser <browser>  browser to use for functional tests

	  This command creates a "tests" directory with a default Intern config file
	  and some sample tests.

	  Browser names:

		chrome, firefox, safari, internet explorer, microsoftedge

intern-cli also tries to provide useful feedback when it notices a problem with its environment:

	$ intern

	  You'll need a local install of Intern before you can use this command.
	  Install it with

		npm install --save-dev intern

## License

intern-cli is offered under the [New BSD](LICENSE) license.

© [SitePen, Inc.](http://sitepen.com) and its [contributors](https://github.com/theintern/intern-cli/graphs/contributors)
