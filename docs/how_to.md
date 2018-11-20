# How To...

<!-- vim-markdown-toc GFM -->

* [Write a custom reporter](#write-a-custom-reporter)
* [Use TypeScript modules directly](#use-typescript-modules-directly)
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
* [Run tests with headless Firefox](#run-tests-with-headless-firefox)
* [Run tests with Chrome in mobile emulation mode](#run-tests-with-chrome-in-mobile-emulation-mode)
* [Use a custom profile with Firefox](#use-a-custom-profile-with-firefox)

<!-- vim-markdown-toc -->

## Write a custom reporter

See [Reporters](extending.md#reporters)

## Use TypeScript modules directly

In a Node environment, you can use
[ts-node](https://www.npmjs.com/package/ts-node) to load TypeScript tests and
application modules directly. With `ts-node` installed, a test config might look
like:

```json5
{
  plugins: 'node_modules/ts-node/register/index.js',
  suites: 'tests/**/*.ts'
}
```

Declaring `ts-node/register/index.js` as a plugin ensures it’s loaded before any
suites. Once `ts-node` is loaded, Intern can load TypeScript modules directly.

> ⚠️This method does not work in browsers.

## Speed up WebDriver tests

Two features which can have a significant impact on test runtime are code
coverage and browser feature tests. Disabling these features can make test
debugging and development faster.

1.  Disable [code coverage](concepts.md#code-coverage)
    - Remove or comment the `coverage` property in a config file, or set it to
      an empty array or `false`
    - Manually disable coverage when running Intern
      ```
      $ node_modules/.bin/intern coverage=
      ```
2.  Disable browser [feature tests](concepts.md#webdriver-feature-tests)
    ```json5
    {
      environments: {
        browserName: 'chrome',
        fixSessionCapabilities: 'no-detect'
      }
    }
    ```

> ⚠️ Note that disabling feature tests may lead to test failures, particularly
> with older or non-standard browsers.

## Use Intern programmatically

1.  Load Intern
    - In node:
      ```ts
      import intern from 'intern';
      ```
    - In the browser, load the 'browser/intern.js' script
      ```html
      <script src="node_modules/intern/browser/intern.js"></script>
      ```
2.  [Configure](configuration.md) Intern
    ```ts
    intern.configure({
      suites: ['tests/unit/a.js', 'tests/unit/b.js'],
      reporters: 'runner'
    });
    ```
3.  Register for [events](architecture.md#executors)
    ```ts
    intern.on('testStart', test => {
      console.log(`${test.id} has started`);
    });
    ```
4.  Run Intern
    ```ts
    intern.run();
    ```

## Run code before tests start

There several ways to accomplish this:

- If you just need to run some self-contained, synchronous setup code before
  testing starts, use a `plugins` script.
  ```js
  // setup.js
  intern.config.suites.push('./some/other/suite.js');
  ```
  ```json5
  // intern.json
  {
    plugins: 'setup.js'
  }
  ```
- If your setup code is still self-contained but needs to do something
  asynchronous, you can still load it as a `plugins` script, but use a
  `beforeRun` callback to handle the async code:
  ```js
  // setup.js
  intern.on('beforeRun', () => {
    return new Promise(resolve => {
      // async code
    });
  });
  ```
- If your startup code needs to load modules using your test loader (one
  configured with the [loader] option), register it as a plugin. These can run
  async initialization code in the [registerPlugin] method, and also have access
  to any module loader configured for the tests.
  ```js
  // setup.js
  const bar = require('./bar');
  intern.registerPlugin('foo', () {
      return bar.getSomething().then(something => {
          // more async code
      });
  });
  ```
  ```json5
  // intern.json
  {
    plugins: {
      script: 'setup.js',
      useLoader: true
    }
  }
  ```

## Run Intern in my own test page in a browser

Load the `browser/intern.js` bundle in a page using a script tag. This will
create an `intern` global that can be used to configure Intern and start tests.

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
            var registerSuite = intern.getPlugin('interface.object').registerSuite;

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

One way to work with ES modules in Node is to install babel-register and load it
as a plugin. This will let Intern load ES modules transparently, without
requiring a build step. Also set the `esModules` instrumenter option if code
coverage is desired.

```json5
// intern.json
{
  node: {
    plugins: 'node_modules/babel-register/lib/node.js'
  },
  instrumenterOptions: {
    esModules: true
  }
}
```

The most common way to work with ES modules in the browser is to use a loader
that understands ES modules. One option is to use SystemJS configured with babel
support:

```json5
// intern.json
{
  browser: {
    loader: {
      script: 'systemjs',
      options: {
        map: {
          'plugin-babel': 'node_modules/systemjs-plugin-babel/plugin-babel.js',
          'systemjs-babel-build':
            'node_modules/systemjs-plugin-babel/systemjs-babel-browser.js'
        },
        transpiler: 'plugin-babel'
      }
    }
  },
  instrumenterOptions: {
    esModules: true
  }
}
```

Intern also provides an `esm` loader that uses a browser’s native module
support. Internally, modules are loaded using script tags, like:

```html
<script src="myscript.js" type="module"></script>
```

> ⚠️ Note that the `esm` loader requires that _all_ modules in a dependecy tree
> be ESMs, so its utility is currently somewhat limited.

## Use Intern with a remote service like BrowserStack

1.  Write some unit and/or functional test suites and add them to your
    `intern.json`
    ```json5
    {
      suites: 'tests/unit/*.js',
      functionalSuites: 'tests/functional/*.js'
    }
    ```
2.  Select the desired [tunnel] in your `intern.json`
    ```json5
    {
      tunnel: 'browserstack'
    }
    ```
3.  Provide your auth credentials using environment variables or in your
    `intern.json`
    ```
    $ export BROWSERSTACK_USERNAME=someone@somedomain.com
    $ export BROWSERSTACK_ACCESS_KEY=123-456-789
    ```
    _or_
    ```json5
    {
      tunnelOptions: {
        username: 'someone@somedomain.com',
        accessKey: '123-456-789'
      }
    }
    ```
4.  Select some [environments]. Be sure to use the cloud service’s naming
    conventions.
    ```json5
    {
      environments: [
        { browserName: 'chrome', version: 'latest', platform: 'MAC' }
      ]
    }
    ```
5.  Run Intern
    ```
    $ node_modules/.bin/intern
    ```

## Test non-modular code

Browser code that doesn’t support any module system and expects to be loaded
along with other dependencies in a specific order can be loaded using the
`plugins` config option.

```json5
{
  browser: {
    plugins: ['lib/jquery.js', 'lib/plugin.jquery.js']
  }
}
```

Modules specified in the `plugins` array will be loaded sequentially in the
order specified.

## Test non-CORS web APIs

When writing unit tests with Intern, occasionally you will need to interact with
a web service. However, because the Intern serves code at
`http://localhost:9000` by default, any cross-origin requests will fail. In
order to test Ajax requests wihtout using CORS of JSONP, setup a reverse proxy
to Intern and tell the in-browser test runner to load from that URL by setting
the `serverUrl` configuration option.

### Option 1: Send all traffic except web services to Intern

1.  Set Intern’s `serverUrl` config option to point to the URL of the web server
2.  Set the web server to reverse proxy to `http://localhost:9000` by default
3.  Add `location` directives to pass web service URLs to the web service
    instead

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

1.  Set Intern’s `serverUrl` config option to point to the URL of the web server
2.  Set the web server to reverse proxy to `http://localhost:9000` for the
    special `/__intern/` location, plus any directories containing JavaScript
    code

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

Intern interacts with headless Chrome in the same fashion as regular Chrome, it
just has to tell chromedriver to open a headless session. Do this by providing
`headless` and `disable-gpu` arguments to chromedriver in an environment
descriptor in the test config. You may also want to set the `window-size` option
to ensure the browser is large enough to properly render your interface.

```json5
{
  environments: [
    {
      browserName: 'chrome',
      'goog:chromeOptions': {
        args: ['headless', 'disable-gpu', 'window-size=1024,768']
      }
    }
  ]
}
```

One of the main benefits of headless Chrome, aside from not having to worry
about window focus, is speed. You can
[speed up the testing process](#speed-up-webdriver-tests) further by setting the
`fixSessionCapabilities` capability to `false` or `'no-detect'`.

## Run tests with headless Firefox

Setting up Intern to use Firefox in headless mode is much like setting it up for
[headless Chrome](#run-tests-with-headless-chrome). Simply provide a 'headless'
argument to geckodriver in an environment descriptor in the test config.

```json5
{
  environments: [
    {
      browserName: 'firefox',
      'moz:firefoxOptions': {
        args: ['-headless', '--window-size=1024,768']
      }
    }
  ]
}
```

## Run tests with Chrome in mobile emulation mode

Intern interacts with Chrome in mobile emulation mode in the same fashion as
regular Chrome, it just has to tell chromedriver to open a mobile emulation
session. Do this by providing a 'mobileEmulation' property in
`goog:chromeOptions` in an environment descriptor.

```json5
{
  environments: [
    {
      browserName: 'chrome',
      'goog:chromeOptions': {
        mobileEmulation: {
          deviceName: 'Pixel 2'
        }
      }
    }
  ]
}
```

Mobile emulation mode may be combined with
[headless mode](#run-tests-with-headless-chrome), as well.

## Use a custom profile with Firefox

1.  Setup a profile in Firefox, create a ZIP archive of the profile directory,
    and base-64 encode it. The
    [firefox-profile](https://www.npmjs.com/package/firefox-profile) package can
    help with this.
2.  Add the profile to the Firefox entry in your `environments` config property.
    How this is done depends on the version of Firefox in use.
    - For older versions of Firefox, set a `firefox_profile` property:
    ```json5
    {
      environments: [
        {
          browserName: 'firefox',
          firefox_profile: 'UEsDBBQACAAIACynEk...'
        }
      ]
    }
    ```
    - Starting with geckodriver 0.19, use a `moz:firefoxOptions` property:
    ```json5
    {
      environments: [
        {
          browserName: 'firefox',
          'moz:firefoxOptions': {
            profile: 'UEsDBBQACAAIACynEk...'
          }
        }
      ]
    }
    ```

[environments]:
  https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/environments
[loader]:
  https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FExecutor/loader
[registerplugin]:
  https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/registerplugin
[tunnel]:
  https://theintern.io/docs.html#Intern/4/api/lib%2Fexecutors%2FNode/tunnel-1
