# How To...

<!-- vim-markdown-toc GFM -->

* [Speed up WebDriver tests](#speed-up-webdriver-tests)
* [Use Intern programmatically](#use-intern-programmatically)
* [Run code before tests start](#run-code-before-tests-start)
* [Run Intern in my own test page in a browser](#run-intern-in-my-own-test-page-in-a-browser)
* [Write tests in an HTML page](#write-tests-in-an-html-page)
* [Test ES modules](#test-es-modules)
* [Use Intern with a remote service like BrowserStack](#use-intern-with-a-remote-service-like-browserstack)
* [Test non-modular code](#test-non-modular-code)
* [Test non-CORS web APIs](#test-non-cors-web-apis)
    * [Option 1: Send all traffic except web services to Intern](#option-1-send-all-traffic-except-web-services-to-intern)
    * [Option 2: Only send JavaScript traffic to Intern](#option-2-only-send-javascript-traffic-to-intern)
* [Run tests with headless Chrome](#run-tests-with-headless-chrome)
* [Use a custom profile with Firefox](#use-a-custom-profile-with-firefox)

<!-- vim-markdown-toc -->

## Speed up WebDriver tests

Two features which can have a significant impact on test runtime are code coverage and browser feature tests. Disabling these features can make test debugging and development faster.

1. Disable [code coverage](concepts.md#code-coverage)
   * Remove or comment the `coverage` property in a config file, or set it to an empty array or `false`
   * Manually disable coverage when running Intern
     ```
     $ node_modules/.bin/intern coverage=
     ```
2. Disable browser [feature tests](concepts.md#webdriver-feature-tests)
   ```js
   {
       "environments": {
           "browserName": "chrome",
           "fixSessionCapabilities": "no-detect"
       }
   }

> ⚠️  Note that disabling feature tests may lead to test failures, particularly with older or non-standard browsers.

## Use Intern programmatically

1. Load Intern
   * In node:
     ```js
     import intern from 'intern';
     ```
   * In the browser, load the 'browser/intern.js' script
     ```html
     <script src="node_modules/intern/browser/intern.js"></script>
     ```
2. Configure Intern
   ```js
   intern.configure({
       suites: [
           'tests/unit/a.js',
           'tests/unit/b.js'
       ],
       reporters: 'runner'
   });
   ```
3. Run Intern
   ```js
   intern.run();
   ```

## Run code before tests start

There several ways to accomplish this:

* If you just need to run some self-contained, synchronous setup code before testing starts, use a `plugins` script.
  ```js
  // setup.js
  intern.config.suites.push('./some/other/suite.js')
  ```
  ```js
  // intern.json
  {
      "plugins": "setup.js"
  }
  ```
* If your setup code is still self-contained but needs to do something asynchronous, you can still load it as a `plugins` script, but use a `beforeRun` callback to handle the async code:
  ```js
  // setup.js
  intern.on('beforeRun', function () {
      return new Promise(function (resolve) {
          // async code
      });
  });
  ```
* If your startup code needs to load modules using your test loader (one configured with the [loader] option), register it as a plugin. These can run async initialization code in the [registerPlugin] method, and also have access to any module loader configured for the tests.
   ```js
   // setup.js
   const bar = require('./bar');
   intern.registerPlugin('foo', function () {
       return bar.getSomething().then(function (something) {
           // more async code
       });
   });
   ```
   ```js
   // intern.json
   {
       "plugins": "setup.js"
   }
   ```

## Run Intern in my own test page in a browser

Load the `browser/intern.js` bundle in a page using a script tag. This will create an `intern` global that can be used
to configure Intern and start tests.

```html
<!DOCTYPE html>
<html>
    <head>
        <script src="node_modules/intern/browser/intern.js"></script>
        <script>
            intern.configure({
                suites: [
                    'tests/unit/a.js',
                    'tests/unit/b.js'
                ],
                reporters: 'html'
            });
            intern.run();
        </script>
    </head>
    <body>
    </body>
</html>
```

If you’d rather not install Intern, you can load the package from a CDN, like:

```html
<script src="https://unpkg.com/intern@next/browser/intern.js"></script>
```

## Write tests in an HTML page

```html
<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">

        <script src="https://unpkg.com/intern@next/browser/intern.js"></script>
        <script>
            var registerSuite = intern.getInterface('object').registerSuite;

            registerSuite('app/module', {
                test1: function () {
                    // ...
                },
                test2: function () {
                    // ...
                },
                // ...
            });

            intern.configure({ reporters: 'html' });
            intern.run();
        </script>
    </head>
    <body>
    </body>
</html>
```

## Test ES modules

One way to work with ES modules in Node is to install babel-register and load it as a plugin. This will let Intern load ES modules transparently, without requiring a build step. Also set the `esModules` instrumenter option if code coverage is desired.

```js
// intern.json
{
    "node": {
        "plugins": "node_modules/babel-register/lib/node.js"
    },
    "instrumenterOptions": {
        "esModules": true
    }
}
```

To work with ES modules in the browser, you’ll need to setup a loader. One option is to use SystemJS configured with babel support:

```js
// intern.json
{
    "browser": {
        "loader": {
            "script": "systemjs",
            "options": {
                "map": {
                    "plugin-babel": "node_modules/systemjs-plugin-babel/plugin-babel.js",
                    "systemjs-babel-build": "node_modules/systemjs-plugin-babel/systemjs-babel-browser.js"
                },
                "transpiler": "plugin-babel"
            }
        }
    },
    "instrumenterOptions": {
        "esModules": true
    }
}
```

## Use Intern with a remote service like BrowserStack

1. Write some unit and/or functional test suites and add them to your `intern.json`
   ```js
   // intern.json
   {
       "suites": "tests/unit/*.js",
       "functionalSuites": "tests/functional/*.js"
   }
   ```
2. Select the desired [tunnel] in your `intern.json`
   ```js
   // intern.json
   {
       "tunnel": "browserstack"
   }
   ```
3. Provide your auth credentials using environment variables or in your `intern.json`
   ```
   $ export BROWSERSTACK_USERNAME=someone@somedomain.com
   $ export BROWSERSTACK_ACCESS_KEY=123-456-789
   ```
   _or_
   ```js
   // intern.json
   {
       "tunnelOptions": {
           "username": "someone@somedomain.com",
           "accessKey": "123-456-789"
       }
   }
   ```
4. Select some [environments]. Be sure to use the cloud service’s naming conventions.
   ```js
   // intern.json
   {
       "environments": [
           { "browserName": "chrome", "version": "latest", "platform": "MAC" }
       ]
   }
   ```
5. Run Intern
   ```
   $ node_modules/.bin/intern
   ```

## Test non-modular code

Browser code that doesn’t support any module system and expects to be loaded along with other dependencies in a specific order can be loaded using the `require` config option.

```js
// intern.json
{
    "browser": {
        "plugins": [
            "lib/jquery.js",
            "lib/plugin.jquery.js"
        ]
    }
}
```

Modules specified in the `plugins` array will be loaded sequentially in the order specified.

## Test non-CORS web APIs

When writing unit tests with Intern, occasionally you will need to interact with a Web service. However, because the Intern serves code at `http://localhost:9000` by default, any cross-origin requests will fail. In order to test Ajax requests wihtout using CORS of JSONP, setup a reverse proxy to Intern and tell the in-browser test runner to load from that URL by setting the `serverUrl` configuration option.

### Option 1: Send all traffic except web services to Intern

1. Set Intern’s `serverUrl` config option to point to the URL of the web server
2. Set the web server to reverse proxy to `http://localhost:9000` by default
3. Add `location` directives to pass web service URLs to the web service instead

An nginx config implementing this pattern might look like:

```nginx
server {
  server_name proxy.example;

  location /web-service/ {
    # This will proxy to http://www.web-service.example/web-service/<rest of url>;
    # use `proxy_pass http://www.web-service.example/` to proxy to
    # http://www.web-service.example/<rest of url> instead
    proxy_pass http://www.web-service.example;
  }

  location / {
    proxy_pass http://localhost:9000;
  }
}
```

### Option 2: Only send JavaScript traffic to Intern

1. Set Intern’s `serverUrl` config option to point to the URL of the web server
2. Set the web server to reverse proxy to `http://localhost:9000` for the special `/__intern/` location, plus any directories containing JavaScript code


An nginx config implementing this pattern might look like:

```nginx
server {
  server_name proxy.example;
  root /var/www/;

  location /js/ {
    proxy_pass http://localhost:9000;
  }

  location /__intern/ {
    proxy_pass http://localhost:9000;
  }

  location / {
    try_files $uri $uri/ =404;
  }
}
```

## Run tests with headless Chrome

Intern interacts with headless Chrome in the same fashion as regular Chrome, it just has to tell chromedriver to open a headless session. Do this by providing 'headless' and 'disable-gpu' arguments to chromedriver in an environment descriptor in the test config.

```js
{
    "environments": [
        {
            "browserName": "chrome",
            "chromeOptions": { "args": ["headless", "disable-gpu"] }
        }
    ]
}
```

One of the main benefits of headless Chrome, aside from not having to worry about window focus, is speed. You can [speed up the testing process](#speed-up-webdriver-tests) further by setting the `fixSessionCapabilities` capability to `false` or `'no-detect'`.

## Use a custom profile with Firefox

1. Setup a profile in Firefox, create a ZIP archive of the profile directory, and base-64 encode it. The [firefox-profile](https://www.npmjs.com/package/firefox-profile) package can help with this.
2. Add the profile to the Firefox entry in your `environments` config property. How this is done depends on the version of Firefox in use.
   * For older versions of Firefox, set a `firefox_profile` property:
   ```json
   {
       "environments": [{
           "browserName": "firefox",
           "firefox_profile": "UEsDBBQACAAIACynEk..."
       }]
   }
   ```
   * Starting with geckodriver 0.19, use a `moz:firefoxOptions` property:
   ```json
   {
       "environments": [{
           "browserName": "firefox",
           "moz:firefoxOptions": {
               "profile": "UEsDBBQACAAIACynEk..."
           }
       }]
   }

[environments]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/environments
[loader]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/loader
[registerPlugin]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/registerplugin
[tunnel]: https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/tunnel-1
