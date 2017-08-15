# Running tests

<!-- vim-markdown-toc GFM -->
* [The browser client](#the-browser-client)
    * [initialBaseUrl (string)](#initialbaseurl-string)
* [The Node.js client](#the-nodejs-client)
* [The test runner](#the-test-runner)
* [Using custom arguments](#using-custom-arguments)
* [Using Grunt](#using-grunt)
* [Using Gulp](#using-gulp)

<!-- vim-markdown-toc -->

## The browser client

The browser client allows unit tests to be run directly in a browser without any server other than a regular HTTP server. This is useful when you are in the process of writing unit tests that require a browser, or when you need to run a debugger in the browser to inspect a test failure.

The browser client is loaded by navigating to `intern/client.html`. Assuming an Intern configuration file is located at `my-project/tests/intern`, a typical execution that runs all unit tests would look like this:

```
http://localhost/my-project/node_modules/intern/client.html?
  config=tests/intern
```

As can be seen from this example, because there is no concept of a “working directory” in URLs, the browser client chooses the directory two levels above `client.html` to be the root directory for the current test run. This can be overridden by specifying an `initialBaseUrl` argument:

```
http://localhost/my-project/node_modules/intern/client.html?
  initialBaseUrl=/&
  config=my-project/tests/intern
```

Additional arguments to the browser client can be put in the query string. A more complex execution with arguments overriding the [suites](./configuration.md#suites) and [reporters](./configuration.md#reporters) properties from the configuration file might look like this:

```
http://localhost/my-project/node_modules/intern/client.html?
  config=tests/intern&
  suites=tests/unit/request&
  suites=tests/unit/animation&
  reporters=Console&
  reporters=Html
```

The browser client is also used by the [test runner](#the-test-runner) to run unit tests in each browser.

The browser client supports the following arguments:

| Argument                                                             | Description                                                                                                                  | Default                        |
|----------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|--------------------------------|
| config                                                               | The module ID of the Intern configuration file that should be used. Relative to `initialBaseUrl`. This argument is required. | none                           |
| [initialBaseUrl](./configuration.md#baseurl) | The path to use when resolving the `basePath` in a browser.                                                                  | `'node_modules/intern/../../'` |

### initialBaseUrl (string) 

The path to use when resolving the `basePath` in a browser. Since browsers do not have any concept of a current working directory, using this argument allows a pseudo-cwd to be specified for the browser client in order to match up file paths with what exists on the underlying filesystem. This argument should always be an absolute path (i.e. it should be the entire path that comes after the domain name).

You can also specify any valid [configuration option](./configuration.md) in the query string.

## The Node.js client

The Node.js client allows unit tests to be run directly within a local Node.js environment. This is useful when you are writing unit tests for code that runs in Node.js. It is invoked by running intern-client on the command-line.

A typical execution that runs all tests and outputs results to the console would look like this:

```
intern-client config=tests/intern
```

The `config` argument is a module ID, not a file path. Providing a file path may cause confusing or unpredictable results.

When running on Windows, all command-line options must be surrounded by quotes.

The commands shown above rely on npm being installed and configured properly. If your environment PATH is not set properly, you may need to run node\_modules/.bin/intern-client instead of intern-client.

A more complex execution with arguments overriding the [suites](./configuration.md#suites) and [reporters](./configuration.md#reporters) properties from the configuration file might look like this:

```
intern-client config=tests/intern suites=tests/unit/request \
  suites=tests/unit/animation \
  reporters=Console \
  reporters=LcovHtml
```

The Node.js client supports the following arguments:

| Argument | Description                                                                                                                               |
|----------|-------------------------------------------------------------------------------------------------------------------------------------------|
| config   | The module ID of the Intern configuration file that should be used. Relative to the current working directory. This argument is required. |

You can also specify any valid [configuration option](./configuration.md) as an argument on the command-line.

## The test runner

The test runner allows functional tests to be executed against a Web browser or native mobile application. It also allows unit tests & functional tests to be executed on multiple environments at the same time. This is useful when you want to automate UI testing, or when you want to run your entire test suite against multiple environments at once (for example, in [continuous integration](https://theintern.github.io/intern/#ci)). It is invoked by running intern-runner on the command-line.

In order to use the test runner, you will need a WebDriver server. The WebDriver server is responsible for providing a way to control to all of the environments that you want to test. You can get a WebDriver server in one of a few different ways:

-   [By installing a copy of Selenium on your local machine](https://theintern.github.io/intern/#local-selenium)
-   [By getting an account with a cloud-hosted Selenium provider](https://theintern.github.io/intern/#hosted-selenium)
-   [By setting up a distributed Selenium Grid](https://theintern.github.io/intern/#selenium-grid)

A typical execution that runs all tests against all [environments](./configuration.md#environments) and outputs aggregate test & code coverage results to the console would look like this:

```
intern-runner config=tests/intern
```

The `config` argument is a module ID, not a file path. Providing a file path may cause confusing or unpredictable results.

When running on Windows, all command-line options must be surrounded by quotes.

The commands shown above rely on npm being installed and configured properly. If your environment PATH is not set properly, you may need to run node\_modules/.bin/intern-runner instead of intern-runner.

A more complex execution that overrides the [reporters](./configuration.md#reporters) and [functionalSuites](./configuration.md#functionalsuites) properties from the configuration file might look like this:

```
intern-runner config=tests/intern \
  reporters=Runner reporters=LcovHtml \
  functionalSuites=tests/functional/home \
  functionalSuites=tests/functional/cart
```

The test runner is the *only* executor that runs functional tests.

The test runner supports the following arguments:

| Argument | Description                                                                                                                               |
|----------|-------------------------------------------------------------------------------------------------------------------------------------------|
| config   | The module ID of the Intern configuration file that should be used. Relative to the current working directory. This argument is required. |

You can also specify any valid [configuration option](https://theintern.github.io/intern/#configuration) as an argument on the command-line.

## Using custom arguments

Intern allows arbitrary arguments to be passed on the command-line that can then be retrieved through the main Intern object. This is useful for cases where you want to be able to pass things like custom ports, servers, etc. dynamically:

```js
define(function (require) {
  var intern = require('intern');

  // arguments object
  intern.args;
});
```

This makes it possible to, for example, define a dynamic proxy URL from the command-line or Grunt task:

```js
define(function (require) {
  var intern = require('intern');

  var SERVERS = {
    id1: 'http://id1.example/',
    id2: 'http://id2.example/'
  };

  return {
    proxyUrl: SERVERS[intern.args.serverId],

    // …additional configuration…
  };
});
```

```
intern-runner config=tests/intern serverId=id1
````

In Intern 3, all arguments from the command-line are automatically added to the configuration object, so default configuration properties can be changed without needing to use custom arguments. For instance, in the previous example,

```
intern-runner config=tests/intern proxyUrl=http://id1.example/
```

could have been used instead of a custom argument.

## Using Grunt

Grunt support is built into Intern. Install Intern and load the Grunt task into your Gruntfile using `grunt.loadNpmTasks('intern')`:

```js
module.exports = function (grunt) {
  // Load the Intern task
  grunt.loadNpmTasks('intern');

  // Configure tasks
  grunt.initConfig({
    intern: {
      someReleaseTarget: {
        options: {
          runType: 'runner', // defaults to 'client'
          config: 'tests/intern',
          reporters: [ 'Console', 'Lcov' ],
          suites: [ 'tests/unit/all' ]
        }
      },
      anotherReleaseTarget: { /* … */ }
    }
  });

  // Register a test task that uses Intern
  grunt.registerTask('test', [ 'intern' ]);

  // By default we just test
  grunt.registerTask('default', [ 'test' ]);
};
```

The following task options are available:

| Name                    | Description                                                                                                                                                                                                                              | Default      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| browserstackAccessKey   | The access key for authentication with BrowserStack.                                                                                                                                                                                     | none         |
| browserstackUsername    | The username for authentication with BrowserStack.                                                                                                                                                                                       | none         |
| cbtApikey               | The API key for authentication with CrossBrowserTesting.                                                                                                                                                                                 | none         |
| cbtUsername             | The username for authentication with CrossBrowserTesting.                                                                                                                                                                                | none         |
| runType                 | The execution mode in which Intern should run. This may be `'runner'` for the [test runner](#the-test-runner), or `'client'` for the [Node.js client](#the-nodejs-client).                                                               | `'client'`   |
| sauceAccessKey          | The access key for authentication with Sauce Labs.                                                                                                                                                                                       | none         |
| sauceUsername           | The username for authentication with Sauce Labs.                                                                                                                                                                                         | none         |
| testingbotKey           | The API key for authentication with TestingBot.                                                                                                                                                                                          | none         |
| testingbotSecret        | The API key for authentication with TestingBot.                                                                                                                                                                                          | none         |

The following events are available:

| Event                        | Description                               |
|------------------------------|-------------------------------------------|
| intern.pass(message: string) | This event is emitted when a test passes. |
| intern.fail(message: string) | This event is emitted when a test fails.  |

The current Grunt events are rudimentary, based on the output of the default [console reporter](./reporters.md#test-results-reporters), and do not provide much detail into the actual state of the test runner to Grunt tasks. Future versions of Intern are likely to improve to provide first-class event support, if sufficient demand exists for this feature.

## Using Gulp

Intern doesn’t provide a gulp plugin, but running Intern with gulp is much like running it with Grunt. The key difference is that Intern is run explicitly in gulp rather than through a plugin. The following example shows one way to do this

```js
gulp.task('test', function (done) {
  // Define the Intern command line
  var command = [
    './node_modules/intern/runner.js',
    'config=tests/intern'
  ];

  // Add environment variables, such as service keys
  var env = Object.create(process.env);
  env.BROWSERSTACK_ACCESS_KEY = '123456';
  env.BROWSERSTACK_USERNAME = 'foo@nowhere.com';

  // Spawn the Intern process
  var child = require('child_process').spawn('node', command, {
    // Allow Intern to write directly to the gulp process's stdout and
    // stderr.
    stdio: 'inherit',
    env: env
  });

  // Let gulp know when the child process exits
  child.on('close', function (code) {
    if (code) {
      done(new Error('Intern exited with code ' + code));
    }
    else {
      done();
    }
  });
});
```

Additional configuration options, such as `suites` and `reporters`, can be specified just as they would for a typical Intern [client](#the-nodejs-client) or [runner](#the-test-runner) command line. Also, `spawn` isn’t a requirement. An Intern process has to be started, but some other library such as `gulp-shell` or `shelljs` could be used for this purpose. The only requirement is that the gulp task run Intern and be notified when it finishes.
