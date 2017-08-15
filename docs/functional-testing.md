
-   [Functional testing](https://theintern.github.io/intern/#functional-testing)
    -   [Writing a functional test](https://theintern.github.io/intern/#writing-functional-test)
    -   [Page objects](https://theintern.github.io/intern/#page-objects)
    -   [Testing native apps](https://theintern.github.io/intern/#native-apps)
    -   [Debugging](https://theintern.github.io/intern/#debugging)




Functional testing
------------------

### Writing a functional test

As described in the [fundamentals overview](https://theintern.github.io/intern/#fundamentals-overview), functional testing enables application testing by automating user interactions like navigating to pages, scrolling, clicking, reading content, etc.. It’s used as an automated alternative to manual user testing.

Functional tests are registered using the same interfaces as [unit tests](https://theintern.github.io/intern/#writing-unit-tests), and use the same internal [Suite](https://theintern.github.io/intern/#suite-object) and [Test](https://theintern.github.io/intern/#test-object) objects, but are loaded using the [functionalSuites](https://theintern.github.io/intern/#option-functionalSuites) configuration option instead of the [suites](https://theintern.github.io/intern/#option-suites) option and run inside the test runner instead of inside the environment being tested.

When writing a functional test, instead of executing application code directly, use the [Leadfoot Command object](https://theintern.github.io/leadfoot/module-leadfoot_Command.html) at `this.remote` to automate interactions that you’d normally perform manually to test an application:

    define(function (require) {
      var registerSuite = require('intern!object');
      var assert = require('intern/chai!assert');

      registerSuite({
        name: 'index',

        'greeting form': function () {
          return this.remote
            .get(require.toUrl('index.html'))
            .setFindTimeout(5000)
            .findByCssSelector('body.loaded')
            .findById('nameField')
              .click()
              .type('Elaine')
              .end()
            .findByCssSelector('#loginForm input[type=submit]')
              .click()
              .end()
            .findById('greeting')
              .getVisibleText()
              .then(function (text) {
                assert.strictEqual(text, 'Hello, Elaine!',
                  'Greeting should be displayed when the form is submitted');
              });
        }
      });
    });

Always make sure that you either `return` the final call to the remote object, or return another Promise that resolves after all of your commands have finished executing. If you don’t, Intern won’t wait before moving on to the next test, and your test suite will be broken.

In this example, taken from the [Intern tutorial](https://github.com/theintern/intern-tutorial), we’re automating interaction with a basic form that is supposed to accept a name from the user and then display it as a greeting in the user interface. As can be seen from the code above, the series of steps the test takes are as follows:

-   Load the page. `require.toUrl` is used here to convert a local file path (index.html) into a URL that can actually be loaded by the remote browser ([http://localhost:9000](https://theintern.github.io/intern/#option-proxyUrl)/index.html).
-   Set a timeout of 5 seconds for each attempt to find an element on the page. This ensures that even if the browser takes a couple of seconds to create an element, the test won’t fail
-   Wait for the page to indicate it has loaded by putting a `loaded` class on the body element
-   Find the form field where the name should be typed
-   Click the field and type a name into it
-   Find the submit button for the form. Note that if `end` hadn’t been called on the previous line, Intern would try to find the `#loginForm input[type=submit]` element from inside the previously selected `nameField` element, instead of inside the body of the page
-   Click the submit button
-   Find the element where the greeting is supposed to show
-   Get the text from the greeting
-   Verify that the correct greeting is displayed

Calling `this.remote.quit()` will break Intern, so don’t do it. Intern will always handle cleaning up the remote environment on your behalf once testing is finished.

### Page objects

A page object is like a widget for your test code. It abstracts away the details of your UI so you can avoid tightly coupling your test code to a specific view (DOM) tree design.

Using page objects means that if the view tree for part of your UI is modified, you only need to make a change in the page object to fix all your tests. Without page objects, every time the views in your application change, you’d need to touch every single test that interacts with that part of the UI.

Once you’ve written a page object, your tests will use the page object to interact with a page instead of the low-level methods of the `this.remote` object.

For example, a page object for the index page of a Web site could be written like this:

    // in tests/support/pages/IndexPage.js
    define(function (require) {
      // the page object is created as a constructor
      // so we can provide the remote Command object
      // at runtime
      function IndexPage(remote) {
        this.remote = remote;
      }

      IndexPage.prototype = {
        constructor: IndexPage,

        // the login function accepts username and password
        // and returns a promise that resolves to `true` on
        // success or rejects with an error on failure
        login: function (username, password) {
          return this.remote
            // first, we perform the login action, using the
            // specified username and password
            .findById('login')
            .click()
            .type(username)
            .end()
            .findById('password')
            .click()
            .type(password)
            .end()
            .findById('loginButton')
            .click()
            .end()
            // then, we verify the success of the action by
            // looking for a login success marker on the page
            .setFindTimeout(5000)
            .findById('loginSuccess')
            .then(function () {
              // if it succeeds, resolve to `true`; otherwise
              // allow the error from whichever previous
              // operation failed to reject the final promise
              return true;
            });
        },

        // …additional page interaction tasks…
      };

      return IndexPage;
    });

Then, the page object would be used in tests instead of the `this.remote` object:

    // in tests/functional/index.js
    define([
      'intern!object',
      'intern/chai!assert',
      '../support/pages/IndexPage'
    ], function (registerSuite, assert, IndexPage) {
      registerSuite(function () {
        var indexPage;
        return {
          // on setup, we create an IndexPage instance
          // that we will use for all the tests
          setup: function () {
            indexPage = new IndexPage(this.remote);
          },

          'successful login': function () {
            // then from the tests themselves we simply call
            // methods on the page object and then verify
            // that the expected result is returned
            return indexPage
              .login('test', 'test')
              .then(function (loggedIn) {
                assert.isTrue(loggedIn,
                  'Valid username and password should log in successfully');
              });
          },

          // …additional tests…
        };
      });
    });

### Testing native apps

Native mobile application UIs can be tested by Intern using an [Appium](http://appium.io/), [ios-driver](http://ios-driver.github.io/ios-driver/), or [Selendroid](http://selendroid.io/) server. Each server has slightly different support for WebDriver, so make sure to read each project’s documentation to pick the right one for you.

Always be sure to set `fixSessionCapabilities: false` in your environment capabilities when testing a native app to bypass feature detection code that only works for Web apps.

#### Appium

To test a native app with Appium, one method is to pass the path to a valid IPA or APK using the `app` key in your [environments](https://theintern.github.io/intern/#option-environments) configuration:

    {
      environments: [
        {
          platformName: 'iOS',
          app: 'testapp.ipa',
          fixSessionCapabilities: false
        }
      ]
    }

You can also use `appPackage` and `appActivity` for Android, or `bundleId` and `udid` for iOS, to run an application that is already installed on a test device:

    {
      environments: [
        {
          platformName: 'iOS',
          bundleId: 'com.example.TestApp',
          udid: 'da39a3ee5e…',
          fixSessionCapabilities: false
        },
        {
          platformName: 'Android',
          appActivity: 'MainActivity',
          appPackage: 'com.example.TestApp',
          fixSessionCapabilities: false
        }
      ]
    }

The available capabilities for Appium are complex, so review the [Appium capabilities documentation](http://appium.io/slate/en/master/#caps.md) to understand all possible execution modes.

Once the application has started successfully, you can interact with it using any of the [supported WebDriver APIs](http://appium.io/slate/en/master/?javascript#finding-and-interacting-with-elements).

#### ios-driver

To test a native app with ios-driver, first run ios-driver, passing one or more app bundles for the applications you want to test:

    java -jar ios-driver.jar -aut TestApp.app

Then, pass the bundle ID and version using the `CFBundleName` and `CFBundleVersion` keys in your [environments](https://theintern.github.io/intern/#option-environments) configuration:

    {
      environments: [
        {
          device: 'iphone',
          CFBundleName: 'TestApp',
          CFBundleVersion: '1.0.0',
          // required for ios-driver to use iOS Simulator
          simulator: true,
          fixSessionCapabilities: false
        }
      ]
    }

Once the application has started successfully, you can interact with it using any of the [supported WebDriver APIs](https://ios-driver.github.io/ios-driver/?page=native).

#### Selendroid

To test a native app with Selendroid, first run Selendroid, passing one or more APKs for the applications you want to test:

    java -jar selendroid.jar -app testapp-1.0.0.apk

Then, pass the Android app ID of the application using the `aut` key in your [environments](https://theintern.github.io/intern/#option-environments) configuration:

    {
      environments: [
        {
          automationName: 'selendroid',
          aut: 'com.example.testapp:1.0.0',
          fixSessionCapabilities: false
        }
      ]
    }

Once the application has started successfully, you can interact with it using any of the [supported WebDriver APIs](http://selendroid.io/native.html).

### Debugging

Keep in mind that JavaScript code is running in two separate environments: your test suites are run in Node.js, while the page loaded by functional tests runs in a web browser. Functional tests can be debugged with Node.js’s built-in debugger, or with the more user-friendly [node-inspector](https://github.com/node-inspector/node-inspector). Note that these instructions are for debugging functional tests, which run in Node.js; debugging code on the test page itself should be done using the browser's debugging tools.

1.  npm install -g node-inspector
2.  Set a breakpoint in your test code by adding a `debugger` statement. Since test modules are loaded dynamically by Intern, they will likely not show up in the debugger’s file list, so you won’t be able use the debugger to set an initial breakpoint.
3.  Launch Node.js with debugging enabled, set to pause on the first line of code:
    -   node --debug-brk node\_modules/intern/runner config=myPackage/test/intern
4.  Launch node-inspector by running node-inspector.
5.  Open Chrome (you must use Chrome as node-inspector leverages Chrome's developer tools) to:
    -   http://127.0.0.1:8080/debug?port=5858
6.  Continue code execution (F8). The tests will run until your debugger statement.
7.  Debug!
