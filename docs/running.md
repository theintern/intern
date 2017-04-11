# Running Intern

There are several ways to run Intern:

* [Node runner](#node-runner)
* [Browser runner](#browser-runner)
* [Grunt](#grunt)
* [Custom node script](#custom-node-script)
* [Custom HTML page](#custom-html-page)

## Node Runner

The node runner is a built in script for running Node-based unit tests and WebDriver tests. Usage can be very simple:

    $ node_modules/.bin/intern

or

    $ node_modules/.bin/intern webdriver

By default, the runner looks for an `intern.json` config file in the project root. This can be changed by providing a
`config` property on the command line, like `config=tests/myconfig.json`. The runner will also accept any other config
properties as command line arguments. For example,

    $ node_modules/.bin/intern suites=tests/foo.js grep=feature1

would only load the suite in `tests/foo.js`, and would only run tests containing the string ‘feature1’ in their IDs.

## Browser Runner

The browser runner is a built in HTML page for running browser-based unit tests. To use, serve the project root
directory using a static webserver and browse to (assuming the server is running on port 8080):

    http://localhost:8080/node_modules/intern/

Similar to the Node runner script, the browser runner will accept a config argument, or any other config properties, as
query args.

    http://localhost:8080/node_modules/intern/?suites=tests/foo.js&grep=feature1

Note that the browser runner can only be used to run unit tests, not functional (i.e., WebDriver) tests.

## Grunt

Intern includes a Grunt task that can be easily loaded with

```js
grunt.loadNpmTasks('intern');
```

The task may be configured using the same options as are used in an `intern.json` file. For example, consider the
following `intern.json` file:

```js
{
  "suites": "tests/unit/**/*.js",
  "preload": "tests/pre.js",
  "loader": { 
    "script": "dojo",
    "config": {
      "packages": [{"name": "app", "location": "."}]
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
                    suites: "tests/unit/**/*.js",
                    preload: "tests/pre.js"
                    "loader": { 
                        "script": "dojo",
                        "config": {
                            "packages": [{"name": "app", "location": "."}]
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

## Custom Node Script

Intern may also be configured and run with a custom script. The basic steps this script must perform are:

1. Load the Node or WebDriver executor module and any reporters that will be used
2. Initialize the executor by calling `<Executor>.initialize`. Configuration information may be passed at this step.
3. Register any reporter classes with `intern.registerReporter`
4. Load suites
5. Call `intern.run()`

## Custom HTML Page

Intern may be configured and run in a browser with a custom HTML page. The basic steps are:

1. Load the Browser executor (`<script src="node_modules/intern/browser/intern.js"></script>`). The `intern.js` script
   will automatically initialize a Browser executor.
2. Configure the executor
3. Load suites
4. Call `intern.run()`
