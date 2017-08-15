# Getting a WebDriver server

<!-- vim-markdown-toc GFM -->
* [Cloud hosting](#cloud-hosting)
    * [BrowserStack](#browserstack)
    * [CrossBrowserTesting](#crossbrowsertesting)
    * [Sauce Labs](#sauce-labs)
    * [TestingBot](#testingbot)
* [Local Selenium](#local-selenium)
    * [Using a WebDriver directly](#using-a-webdriver-directly)
        * [Using ChromeDriver (Chrome-only)](#using-chromedriver-chrome-only)
        * [Using PhantomJS 2](#using-phantomjs-2)
    * [Using Selenium (all browsers)](#using-selenium-all-browsers)
        * [SeleniumTunnel](#seleniumtunnel)
        * [Manually running Selenium](#manually-running-selenium)
* [Selenium Grid](#selenium-grid)

<!-- vim-markdown-toc -->

## Cloud hosting

Using cloud hosting is the fastest way to get an operational Selenium server. Intern natively provides support for four major cloud hosting providers:

-   [BrowserStack](https://browserstack.com/)
-   [CrossBrowserTesting](https://crossbrowsertesting.com/)
-   [Sauce Labs](https://saucelabs.com/)
-   [TestingBot](https://testingbot.com/)

### BrowserStack

1.  [Sign up](https://www.browserstack.com/users/sign_up) for [BrowserStack Automate](https://www.browserstack.com/automate)
2.  Get your Automate username and password from the [Automate account settings page](https://www.browserstack.com/accounts/automate)
3.  Set [tunnel](./configuration.md#tunnel) to `'BrowserStackTunnel'`
4.  Set your username and access key in one of these ways:
    -   Define `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY` environment variables
    -   Set `browserstackUsername` and `browserstackAccessKey` in your Gruntfile’s intern task options
    -   Set `username` and `accessKey` on your [tunnelOptions](./configuration.md#tunneloptions) configuration option

### CrossBrowserTesting

1.  [Sign up](https://www.crossbrowsertesting.com/freetrial) for a trial account
2.  Get your authkey from your account settings page
3.  Set [tunnel](./configuration.md#tunnel) to `'CrossBrowserTestingTunnel'`
4.  Set your username and access key in one of these ways:
    -   Define CBT\_USERNAME and CBT\_APIKEY environment variables
    -   Set `cbtUsername` and `cbtApikey` in your Gruntfile’s intern task options
    -   Set `username` and `apiKey` on your [tunnelOptions](./configuration.md#tunneloptions) configuration option

### Sauce Labs

1.  [Sign up](https://saucelabs.com/signup/trial) for a Sauce Labs account
2.  Get your master account access key from the sidebar of the [Account settings page](https://saucelabs.com/account), or create a separate sub-account on the [sub-accounts page](https://saucelabs.com/sub-accounts) and get a username and access key from there
3.  Set [tunnel](./configuration.md#tunnel) to `'SauceLabsTunnel'`
4.  Set your username and access key in one of these ways:
    -   Define `SAUCE_USERNAME` and `SAUCE_ACCESS_KEY` environment variables
    -   Set `sauceUsername` and `sauceAccessKey` in your Gruntfile’s intern task options
    -   Set `username` and `accessKey` on your [tunnelOptions](./configuration.md#tunneloptions) configuration option

### TestingBot

1.  [Sign up](https://testingbot.com/users/sign_up) for a TestingBot account
2.  Get your API key and secret from the [Account settings page](https://testingbot.com/members/user/edit)
3.  Set [tunnel](./configuration.md#tunnel) to `'TestingBotTunnel'`
4.  Set your API key and secret in one of these ways:
    -   Define `TESTINGBOT_KEY` and `TESTINGBOT_SECRET` environment variables
    -   Set `testingbotKey` and `testingbotSecret` in your Gruntfile’s intern task options
    -   Set `apiKey` and `apiSecret` on your [tunnelOptions](./configuration.md#tunneloptions) configuration option

Cloud hosts typically have their own unique capabilities options, so be sure to read the [capabilities documentation](./configuration.md#capabilities) for the provider you’re using.

## Local Selenium

Depending upon which browsers you want to test locally, a few options are available.

### Using a WebDriver directly

It's possible to run a browser-specific WebDriver in standalone-mode and use Intern with it.

#### Using ChromeDriver (Chrome-only)

If you’re just looking to have a local environment for developing functional tests, a stand-alone ChromeDriver installation works great.

1.  [Download](http://chromedriver.storage.googleapis.com/index.html "ChromeDriver downloads") the latest version of [ChromeDriver](https://sites.google.com/a/chromium.org/chromedriver/)
2.  Set [tunnel](./configuration.md#tunnel) to `'NullTunnel'`
3.  Run chromedriver --port=4444 --url-base=wd/hub
4.  Set your [environments](./configuration.md#environments) capabilities to `[ { browserName: 'chrome' } ]`
5.  Run [the test runner](./running.md#the-test-runner)

If you are having trouble starting the server or getting Intern to communicate with it, verify the server is running correctly by going to <http://localhost:4444/wd/hub/status>. It should return a JSON response with a `status` field of 0.

#### Using PhantomJS 2

If you want to use a fake browser to develop your tests, PhantomJS 2 is an option.

1.  [Download](http://phantomjs.org/download.html) the latest version of [PhantomJS](http://phantomjs.org/)
2.  Set [tunnel](./configuration.md#tunnel) to `'NullTunnel'`
3.  Run phantomjs --webdriver=4444
4.  Set your [environments](./configuration.md#environments) capabilities to `[ { browserName: 'phantomjs' } ]`
5.  Run [the test runner](./running.md#the-test-runner)

Since PhantomJS is not a real browser that your users will ever actually use, it’s not the best idea to rely on it for testing unless you have a [continuous integration](https://theintern.github.io/intern/#ci) system set up to test with real browsers.

### Using Selenium (all browsers)

If you want to test against more than just Chrome, or you want to use multiple browsers at once, you can run a local copy of Selenium. You can do this manually, or using SeleniumTunnel.

#### SeleniumTunnel

If Java (JRE or JDK) is installed on the testing system, you can set the tunnel class to `SeleniumTunnel` to have Intern automatically download and run Selenium. Use the `drivers` tunnel option to tell the tunnel which WebDrivers to download:

```js
tunnel: 'SeleniumTunnel',
tunnelOptions: {
  drivers: [ 'chrome', 'firefox' ]
}
```

Intern will download and start Selenium at the beginning of the functional tests, and will shut it down when the testing process has finished.

Note that to use Selenium with Firefox 47+, you will need to include `marionette: true` in the [environment object](./configuration.md#environments), and code coverage will need to be disabled by setting `excludeInstrumentation: true`.

#### Manually running Selenium

Start by downloading the servers for each platform you want to test:

-   All platforms: [Selenium server standalone](http://selenium-release.storage.googleapis.com/index.html) (selenium-server-standalone-{version}.jar)
-   Firefox & Safari: (bundled with Selenium server)
-   Chrome & Chrome for Android: [ChromeDriver](http://chromedriver.storage.googleapis.com/index.html)
-   Internet Explorer: [IEDriver server](http://selenium-release.storage.googleapis.com/index.html)
-   Android Browser: [Selendroid server with dependencies](https://github.com/selendroid/selendroid/releases/)
-   Mobile Safari: [ios-driver server standalone](http://ios-driver-ci.ebaystratus.com/userContent/)

New versions of Firefox will occasionally break Selenium. If this is the case, downgrade to an earlier version of Firefox until a new Selenium release is available. Once [Marionette](https://developer.mozilla.org/en-US/docs/Mozilla/QA/Marionette) is updated to use the WebDriver wire protocol, this should no longer be an issue.

To start the server, run

```
java -jar selenium-server-standalone-{version}.jar.
```

To use ChromeDriver and IEDriver with a Selenium server, the driver executables must either be placed somewhere in the environment PATH, or their locations must be given explicitly to the Selenium server using the -Dwebdriver.chrome.driver (ChromeDriver) and -Dwebdriver.ie.driver (IEDriver) flags upon starting the Selenium server:

```
java -jar selenium-server-standalone-{version}.jar \
  -Dwebdriver.chrome.driver=/path/to/chromedriver \
  -Dwebdriver.ie.driver=C:/path/to/IEDriverServer.exe
```

Once the server is running, simply configure Intern to point to the server by setting [tunnel](./configuration.md#tunnel) to `'NullTunnel'`, then run the [test runner](./running.md#the-test-runner).

If you are having trouble starting the server or getting Intern to communicate with it, verify the server is running correctly by going to <http://localhost:4444/wd/hub/status>. It should return a JSON response with a `status` field of 0.

Each driver you use with Selenium has its own installation and configuration requirements, so be sure to read the installation instructions for each:

-   [FirefoxDriver](https://code.google.com/p/selenium/wiki/FirefoxDriver)
-   [SafariDriver](https://code.google.com/p/selenium/wiki/SafariDriver)
-   [ChromeDriver](https://sites.google.com/a/chromium.org/chromedriver/home)
-   [IEDriver](http://code.google.com/p/selenium/wiki/InternetExplorerDriver)
-   [Selendroid](http://selendroid.io/)
-   [ios-driver](http://ios-driver.github.io/ios-driver/)

It is not necessary to manually add browser sessions to the server through the Web interface. Selenium will automatically create new sessions when a connection from Intern is established.

## Selenium Grid

selenium-server-standalone-{version}.jar includes both stand-alone and grid server functionality. To start a Selenium Grid, first create a hub by running Selenium server in hub mode:

```
java -jar selenium-server-standalone-{version}.jar -hub
```

The hub normally drives no browsers by its own and simply acts as a forwarding proxy to each of the nodes that have been registered with the hub.

Once you’ve installed and configured all the drivers for one of your grid nodes following the instructions for setting up [local Selenium](https://theintern.github.io/intern/#local-selenium), start the node and register it with the hub:

```
java -jar selenium-server-standalone-2.xx.x.jar -hub http://hub-server:4444/grid/register
```

Once the server is running, simply configure Intern to point to the hub by setting [tunnel](./configuration.md#tunnel) to `'NullTunnel'`, then run the [test runner](./running.md#the-test-runner).

Creating a grid that works with Selendroid and ios-driver requires that additional [selendroid-grid-plugin](http://search.maven.org/#browse%7C-14789988) and [ios-grid-plugin](http://ios-driver-ci.ebaystratus.com/userContent/) plugins be downloaded and added to the Java classpath when starting the grid hub:

```
java -Dfile.encoding=UTF-8 -cp "selendroid-grid-plugin-{version}.jar:ios-grid-plugin-{version}.jar:selenium-server-standalone-{version}.jar" org.openqa.grid.selenium.GridLauncher -capabilityMatcher io.selendroid.grid.SelendroidCapabilityMatcher -role hub
```

When running on Windows, the colons (:) in the -cp argument must be replaced with semicolons (;).

Firefox, Safari, Chrome, Chrome for Android, and Internet Explorer will all be available using a standard Selenium server node. Selendroid and ios-driver, in contrast, use their own custom Selenium servers (`selendroid-standalone-{version}-with-dependencies.jar` and `ios-server-standalone-{version}.jar`), which must be run and registered separately with the hub. ios-driver uses the same hub registration method as the standard Selenium server (-hub http://hub-server…); Selendroid requires [manual registration](http://selendroid.io/scale.html#start) to the hub.
