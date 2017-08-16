# Getting test results

<!-- vim-markdown-toc GFM -->
* [Overview](#overview)
* [Test results reporters](#test-results-reporters)
* [Code coverage reporters](#code-coverage-reporters)
* [Reporter options](#reporter-options)

<!-- vim-markdown-toc -->

## Overview

Information about the state of a test run needs to be published in many different formats in order to properly integrate with different systems. To facilitate this, Intern allows reporters to be registered. A reporter is a simple object that receives messages from the rest of the test system and forwards that information, in the correct format, to a destination, like a file, console, or HTTP server.

There are two primary kinds of reporters: reporters for *test results*, and reporters for *code coverage results*. Intern comes with a set of standard reporters, and also makes it easy to write your own [custom reporters](https://theintern.github.io/intern/#custom-reporters).

Reporters for a test run are defined using the [reporters](https://theintern.github.io/intern/#option-reporters) configuration option.

## Test results reporters

Test results reporters provide information about the tests themselves—whether or not they passed, how long they took to run, and so on.

Intern comes with several different test results reporters:

| Reporter | Description                                                                                                                                                                                                                                                                                                              | Options   |
| -------- | -----------                                                                                                                                                                                                                                                                                                              | ------- |
| Console  | This reporter outputs test pass/fail messages to the console or stdout, grouped by suite. It’s recommended that this reporter only be used by the browser and Node.js clients, and not the test runner, since it does not understand how to group results received from multiple different clients simultaneously. | watermarks                                                                                                                                                                                                                                                                              |
| Html     | This reporter generates a basic HTML report of unit test results. It is designed to be used in the browser client, but can also generate reports in Node.js if a DOM-compatible document object is passed in.                                                                                                            | document                                                                                                                                                                                                            |
| JUnit    | This reporter generates a JUnit “compatible” XML file of unit test results.                                                                                                                                                                                                                                              | filename                                                                     |
| Pretty   | This reporter displays test progress across one or more environments with progress bars while testing is in progress. After all tests are finished, a sorted list of all tests is output along with an overall code coverage summary.                                                                                    | watermarks                                                                                                                                                                                                                             |
| Runner   | This reporter outputs information to the console about the current state of the runner, code coverage and test results for each environment tested, and a total test result. It can only be used in the test runner.                                                                                                     | filename, watermarks                                                                                                                                                                                                   |
| TeamCity | This reporter outputs test result information in a TeamCity-compatible format.                                                                                                                                                                                                                                           | filename                                                                         |

## Code coverage reporters

Code coverage reporters provide information about the state of code coverage—how many lines of code, functions, code branches, and statements were executed by the test system.

Intern comes with several different test results reporters:

| Reporter  | Description                                                                                                                                                                                   | Options               |
| --------  | -----------                                                                                                                                                                                   | -------               |
| Cobertura | This reporter generates a Cobertura-compatible XML report from collated coverage data.                                                                                                        | filename, watermarks  |
| Combined  | This reporter stores coverage data generated by the Node.js client in an intermediate file, and then merges in data generated by the WebDriver runner to generate a combined coverage report. | directory, watermarks |
| Lcov      | This reporter generates an lcov.info from collated coverage data that can be fed to another program that understands the standard lcov data format.                                           | filename, watermarks  |
| LcovHtml  | This reporter generates a set of illustrated HTML reports from collated coverage data.                                                                                                        | directory, watermarks |

> 💡 Generally speaking, code coverage reporters will never work directly from the browser client because they require code to be instrumented in order to collect coverage data.

## Reporter options

As noted in the tables above, each reporter supports one or more different configuration options.

| Option       | Description                                                                                                                                                                                                                                                                 | Default                                                                                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------                                                                                                                                                                            |
| directory    | The directory where output files should be written. This option is only used by reporters that need to write multiple files.                                                                                                                                                | varies by reporter                                                                                                                                                                             |
| document     | A DOM document.                                                                                                                                                                                                                                                             | window.document                                                                                                                                                                                |
| filename     | A filename where output should be written. If a filename is not provided, output will be sent to stdout.                                                                                                                                                                    | stdout                                                                                                                                                                                         |
| watermarks   | The low & high watermarks for code coverage results. Watermarks can be specified for statements, lines, functions, and branches. Normally, code coverage values below the low watermark appear in red, and code coverage values above the high watermark appear in green.   | {<br/>&nbsp;&nbsp;statements:&nbsp;[50,&nbsp;80],<br/>&nbsp;&nbsp;lines:&nbsp;[50,&nbsp;80],<br/>&nbsp;&nbsp;functions:&nbsp;[50,&nbsp;80],<br/>&nbsp;&nbsp;branches:&nbsp;[50,&nbsp;80]<br/>} |
