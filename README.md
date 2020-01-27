# intern-cli

> ⚠️ This repository has been deprecated., and development has been moved into the main
> [Intern repository](https://github.com/theintern/intern).

This module gives [Intern](https://theintern.io) a friendly command line interface that works like a typical POSIX application.

[![Intern](https://theintern.io/images/intern-v3.svg)](https://github.com/theintern/intern/tree/3.4/) [![Intern](https://theintern.io/images/intern-v4.svg)](https://github.com/theintern/intern/tree/master/)

## Getting started

Install it globally:

```
$ npm install -g @theintern/cli
```

You can then run Intern unit tests with:

```
$ intern run
```

When used with Intern 3, intern-cli will use Intern’s Node client by default, and it assumes the test config is located at `./tests/intern.js`. The “runner” runner can be invoked with the `-w/--webdriver` flag.

When used with Intern 4, intern-cli will run all functional and unit tests by default (this is Intern 4‘s default behavior). WebDriver tests can be skipped with the `-n/--node` flag, and Node unit tests can be skipped with the `-w/--webdriver` flag. The cli assumes the test config is at `intern.json`.

## Getting help

Intern-cli provides top level help when run with no arguments:

```
$ intern

  Usage: intern [options] [command]

  Run JavaScript tests


  Options:

	-h, --help     output usage information
	-v, --verbose  show more information about what Intern is doing
	-V, --version  output the version
	--debug        enable the Node debugger


  Commands:

    version                    Show versions of intern-cli and intern
    help [command]             Get help for a command
    init [options]             Setup a project for testing with Intern
    run [options] [args...]    Run tests in Node or in a browser using WebDriver
    serve [options] [args...]  Start a simple web server for running unit tests in a browser on your system
    watch [files]              Watch test and app files for changes and re-run Node-based unit tests when files are updated
```

You can get more information about a particular sub-command with the `help` command or the `-h` option:

```
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
```

intern-cli also tries to provide useful feedback when it notices a problem with its environment:

```
$ intern

  You'll need a local install of Intern before you can use this command.
  Install it with

	npm install --save-dev intern
```

<!-- start-github-only -->

## License

intern-cli is offered under the [New BSD](LICENSE) license.

© [SitePen, Inc.](http://sitepen.com) and its [contributors](https://github.com/theintern/intern-cli/graphs/contributors)

<!-- end-github-only -->
