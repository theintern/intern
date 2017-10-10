# Running Intern

<!-- vim-markdown-toc GFM -->

* [Built-in runners](#built-in-runners)
    * [Node](#node)
    * [Browser](#browser)
    * [Grunt](#grunt)
* [Custom Node Script](#custom-node-script)
* [Custom HTML Page](#custom-html-page)
* [WebDriver servers](#webdriver-servers)
    * [Bare WebDriver server](#bare-webdriver-server)
    * [Selenium](#selenium)
    * [Cloud service](#cloud-service)
        * [BrowserStack](#browserstack)
        * [CrossBrowserTesting](#crossbrowsertesting)
        * [Sauce Labs](#sauce-labs)
        * [TestingBot](#testingbot)

<!-- vim-markdown-toc -->

## Built-in runners

The Node and browser built-in runners load configuration information from the command line / query args and/or a config file. There are no special command line flags when using the built-in runners; in both cases, command line options are [config properties](configuration.md#properties).

### Node

The node runner is a built in script for running Node-based unit tests and WebDriver tests. Usage can be very simple:

```
$ node_modules/.bin/intern
```

or, if using npm 5+:

```
$ npx intern
```

Of course, it can be called from a `package.json` file even more simply:

```js
{
    "scripts": {
        "test": "intern"
    }
}
```

By default, the runner looks for an `intern.json` config file in the project root. This can be changed by providing a `config` property on the command line, like `config=tests/myconfig.json`. The runner will also accept any other config properties as command line arguments. For example,

```
$ npx intern suites=tests/foo.js grep=feature1
```

would only load the suite in `tests/foo.js`, and would only run tests containing the string ‘feature1’ in their IDs.

> 💡 Intern decides what environments to run tests in based on the value of the [environments] config property. If `environments` isn’t set, Intern adds 'node' to it, so that tests will be run in Node. If `environments` is set, Intern will only run tests in the specified environments.

### Browser

The browser runner is a built-in HTML page for running browser-based unit tests. To use it, serve the project root directory using a static webserver and browse to (assuming the server is running on port 8080):

```
http://localhost:8080/node_modules/intern/
```

Intern also has its own static server that can be started with the `serveOnly` config argument:

```
npx intern serveOnly
```

This command will cause Intern to start a static server on the port set by `serverPort`. The main utility offered by this server over any other static server is that it allows glob expressions in the `suites` list to be resolved.

Similar to the Node runner script, the browser runner will accept a config argument, or any other config properties, as query args.

```
http://localhost:8080/node_modules/intern/?suites=tests/foo.js&grep=feature1
```

Note that the browser runner can only be used to run unit tests, not functional (i.e., WebDriver) tests.

### Grunt

Intern includes a Grunt task that can be loaded with

```js
grunt.loadNpmTasks('intern');
```

The task may be configured using the same options as are used in an `intern.json` file. For example, consider the following `intern.json` file:

```js
{
    "suites": "tests/unit/**/*.js",
    "plugins": "tests/pre.js",
    "loader": {
        "script": "dojo",
        "config": {
            "packages": [{"name": "app", "location": "."}]
        }
    }
}
```

An equivalent Grunt config that used the Node executor would look like:

```js
module.exports = function (grunt) {
    grunt.initConfig({
        intern: {
            node: {
                options: {
                    suites: 'tests/unit/**/*.js',
                    plugins: 'tests/pre.js'
                    loader: {
                        script: 'dojo',
                        config: {
                            packages: [{ name: 'app', location: '.' }]
                        }
                    }
                }
            }
        }
    });

    // Loading using a local git copy
    grunt.loadNpmTasks('intern');
};
```

Note that the Grunt task runner doesn’t use the config file loading logic employed by the Node and browser runners. The assumption is that Grunt will be used to construct the desired config.

## Custom Node Script

Intern may also be configured and run with a custom script. The basic steps this script must perform are:

1. Import/require the 'intern' package. This will instantiate a Node executor and assign it to the `intern` global.
2. [Configure the executor](configuration.md#programmatically). Include at least one suite and a reporter.
   ```js
   intern.configure({
       suites: 'tests/unit/a.js',
       reporters: 'runner'
   });
    ```
3. Call `intern.run()`

A very simple run script might look like:

```js
import intern from 'intern';
intern.configure({ suites: 'tests/unit/**/*.js' });
intern.run();
```

See Intern’s [own run script](https://github.com/theintern/intern/blob/master/src/bin/intern.ts) for a more complex example.

## Custom HTML Page

Intern may be configured and run in a browser with a custom HTML page. The basic steps are similar to those for a custom Node script:

1. Load the Browser executor (`<script src="node_modules/intern/browser/intern.js"></script>`). The `intern.js` script will automatically initialize a Browser executor and assign it to an `intern` global.
2. [Configure the executor](configuration.md#programmatically). Include at least one suite and a reporter.
   ```js
   intern.configure({
       suites: 'tests/unit/a.js',
       reporters: 'html'
   });
    ```
3. Call `intern.run()`

## WebDriver servers

When running functional tests, Intern communicates with remote browsers using WebDriver. To do this, it either uses a browser-specific WebDriver server, generally managed by Selenium, or a remote testing service such as BrowserStack.

### Bare WebDriver server

To use a bare WebDriver, such as [chromedriver](https://sites.google.com/a/chromium.org/chromedriver/), use the following steps:

1. Download the latest version of the WebDriver
2. Set the [tunnel] config property to `'null'`
3. Run the WebDriver on port 4444 with a base URL of 'wd/hub'. Alternatively, using the [tunnelOptions] config property, set `port` to a particular port and `pathname` to the WebDriver’s base URL.
4. Set the [environments] config property to 'chrome'.
5. Run Intern

> 💡 To verify that the WebDriver is running on the proper port and path, open a browser to `http://localhost:4444/wd/hub/status. It should return a JSON response with a `status` field of 0.

### Selenium

If you’d rather not manage WebDriver binaries individually, you can use Selenium. Intern defaults to using the 'selenium' tunnel, so configuration is simpler than for a bare WebDriver.

1. Set the [environments] config property to the name of the desired browser ('chrome', 'firefox', etc.)
2. If using 'firefox' or 'internet explorer', also provide the driver name in the [tunnelOptions] config property:
   ```js
   {
       "tunnelOptions": {
           "drivers": ["firefox"]
       }
   }
   ```
3. Run Intern

### Cloud service

Intern comes with built-in support for four cloud testing services via the [digdug library](https://github.com/theintern/digdug): BrowserStack, CrossBrowserTesting, Sauce Labs, and TestingBot. Basic usage for each of these is provided in the following sections.

> 💡 Cloud hosts typically have their own unique capabilities options, so be sure to read the [capabilities] documentation for the provider you’re using.

#### BrowserStack

1. [Sign up](https://www.browserstack.com/users/sign_up) for [BrowserStack Automate](https://www.browserstack.com/automate)
2. Get your Automate username and password from the [Automate account settings page](https://www.browserstack.com/accounts/automate)
3. Set the [tunnel] config property to `'browserstack'`
4. Set your username and access key in one of these ways:
   * Define `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY` environment variables
   * Set `browserstackUsername` and `browserstackAccessKey` in your [Gruntfile’s](#grunt) intern task options
   * Set `username` and `accessKey` on your [tunnelOptions] configuration option
5. Run Intern

#### CrossBrowserTesting

1. [Sign up](https://www.crossbrowsertesting.com/freetrial) for a trial account
2. Get your authkey from your account settings page
3. Set the [tunnel] config property to `'cbt'`
4. Set your username and access key in one of these ways:
   * Define `CBT_USERNAME` and `CBT_APIKEY` environment variables
   * Set `cbtUsername` and `cbtApikey` in your [Gruntfile’s](#grunt) intern task options
   * Set `username` and `accessKey` on your [tunnelOptions] configuration option
5. Run Intern

#### Sauce Labs

1. [Sign up](https://saucelabs.com/signup/trial) for a Sauce Labs account
2. Get your master account access key from the sidebar of the [Account settings page](https://saucelabs.com/account), or create a separate sub-account on the [sub-accounts page](https://saucelabs.com/sub-accounts) and get a username and access key from there
3. Set the [tunnel] config property to `'saucelabs'`
4. Set your username and access key in one of these ways:
   * Define `SAUCE_USERNAME` and `SAUCE_ACCESS_KEY` environment variables
   * Set `sauceUsername` and `sauceAccessKey` in your [Gruntfile’s](#grunt) intern task options
   * Set `username` and `accessKey` on your [tunnelOptions] configuration option
5. Run Intern

#### TestingBot

1. [Sign up](https://testingbot.com/users/sign_up) for a TestingBot account
2. Get your API key and secret from the [Account settings page](https://testingbot.com/members/user/edit)
3. Set the [tunnel] config property to `'testingbot'`
4. Set your API key and secret in one of these ways:
   * Define `TESTINGBOT_KEY` and `TESTINGBOT_SECRET` environment variables
   * Set `testingbotKey` and `testingbotSecret` in your Gruntfile’s intern task options
   * Set `username` and `accessKey` on your [tunnelOptions] configuration option
5. Run Intern

[capabilities]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/capabilities
[environments]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/environments
[tunnel]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/tunnel-1
[tunnelOptions]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/tunneloptions
