# Dig Dug

<!-- prettier-ignore-start -->
<!-- start-github-only -->
[![Build Status](https://travis-ci.org/theintern/digdug.svg?branch=master)](https://travis-ci.org/theintern/digdug)
[![npm version](https://badge.fury.io/js/digdug.svg)](https://badge.fury.io/js/digdug)
[![Average time to resolve an issue](http://isitmaintained.com/badge/resolution/theintern/digdug.svg)](http://isitmaintained.com/project/theintern/digdug "Average time to resolve an issue")
[![Percentage of issues still open](http://isitmaintained.com/badge/open/theintern/digdug.svg)](http://isitmaintained.com/project/theintern/digdug "Percentage of issues still open")

<br><p align="center"><img src="https://cdn.rawgit.com/theintern/digdug/master/docs/logo.svg" alt="Dig Dug logo" height="90"></p><br>
<!-- end-github-only -->
<!-- prettier-ignore-end -->

Dig Dug is a library for downloading and managing WebDriver service tunnels,
along with Selenium and individual WebDrivers.

[![Intern](https://theintern.io/images/intern-v4.svg)](https://github.com/theintern/intern/)

## Configuration

Dig Dug can connect to an existing local WebDriver or Selenium server, manage a
local Selenium server, or connect to various remote cloud testing systems.

### Local server

Use [NullTunnel] to connect to an already-running server such as Selenium or a
standalone ChromeDriver instance. NullTunnel, as its name suggests, essentially
nulls out most of the default functionality in Tunnel, such as the `download`
method (used to download a service tunnel binary). For example, calling `start`
on any of the other tunnel classes would download the necessary tunnel binaries
and spawn a child process, but calling `start` on a NullTunnel does nothing
(with the assumption that the tunnel has already been started).

### Managed Selenium server

Dig Dug can manage a local Selenium server with its [SeleniumTunnel]. By default
the tunnel will download a recent version of Selenium and ChromeDriver. The most
commonly used options for the Selenium tunnel are `version` and `drivers`. The
version option simply sets the version of Selenium to use, such as `'3.4.0'`.
The `drivers` option tells SeleniumTunnel which drivers to download, and
optionally which versions to use. For example, to configure SeleniumTunnel to
use geckodriver 0.18.0 and the default version of ChromeDriver with Selenium
3.5.2:

```js
const tunnel = new SeleniumTunnel({
	version: '3.5.2',
	drivers: [
		'chrome',
		{
			name: 'firefox',
			version: '0.18.0'
		}
	]
});
```

### Cloud testing services

Dig Dug supports the following cloud testing services:

-   [BrowserStack](http://www.browserstack.com)
-   [CrossBrowserTesting](http://www.crossbrowsertesting.com)
-   [Sauce Labs](http://www.saucelabs.com)
-   [TestingBot](http://www.testingbot.com)

In many cases, the only configuration you’ll need to do to create a tunnel is
provide authentication data. This can be provided via options to a Tunnel
constructor or via environment variables. The service tunnels use the following
environment variables:

| Tunnel class                | Environment variables                              |
| --------------------------- | -------------------------------------------------- |
| `BrowserStackTunnel`        | `BROWSERSTACK_USERNAME`, `BROWSERSTACK_ACCESS_KEY` |
| `CrossBrowserTestingTunnel` | `CBT_USERNAME`, `CBT_APIKEY`                       |
| `SauceLabsTunnel`           | `SAUCE_USERNAME`, `SAUCE_ACCESS_KEY`               |
| `TestingBotTunnel`          | `TESTINGBOT_KEY`, `TESTINGBOT_SECRET`              |

Other properties, such as the local port the tunnel should serve on or the URL
of a proxy server the tunnel should go through, can be passed to a tunnel
constructor or set on a tunnel instance. See the API docs for [Tunnel] and its
subclasses for available properties:

-   [BrowserStackTunnel](https://theintern.io/docs.html#Dig%20Dug/2/api/BrowserStackTunnel/browserstackproperties)
-   [CrossBrowserTestingTunnel](https://theintern.io/docs.html#Dig%20Dug/2/api/CrossBrowserTestingTunnel/crossbrowsertestingproperties)
-   [SauceLabsTunnel](https://theintern.io/docs.html#Dig%20Dug/2/api/SauceLabsTunnel/saucelabsproperties)
-   [SeleniumTunnel](https://theintern.io/docs.html#Dig%20Dug/2/api/SeleniumTunnel/seleniumproperties)
-   [TestingBotTunnel](https://theintern.io/docs.html#Dig%20Dug/2/api/TestingBotTunnel/testingbotproperties)

## Usage

To create a new tunnel, import the desired tunnel class, create a new instance,
and call its `start` method. `start` returns a Promise that resolves when the
tunnel has successfully started. For example, to create a new Sauce Labs tunnel:

```js
import SauceLabsTunnel from '@theintern/digdug/SauceLabsTunnel';
const tunnel = new SauceLabsTunnel();
tunnel.start().then(() => {
	// interact with the WebDriver server at tunnel.clientUrl
});
```

Once a tunnel has been started, a test runner can interact with it as described
in the service’s documentation. For example, the Sauce Labs and TestingBot
executables start a WebDriver server on localhost that the test client
communicates with, while a test client will connect to `hub.browserstack.com`
after the tunnel has started to use BrowserStack.

The tunnel classes also provide a `sendJobState` convenience method to let the
remote service know whether a test session passed or failed. This method accepts
a session ID and an object containing service-specific data, and it returns a
Promise that resolves if the job state was successfully updated.

```js
tunnel.sendJobState(sessionId, { success: true });
```

When testing is finished, call the tunnel’s `stop` method to cleanly shut it
down. This method returns a Promise that is resolved when the service tunnel
executable has exited.

```js
tunnel.stop().then(() => {
	// the tunnel has been shut down
});
```

## Utilities

Dig Dug includes a utility script, `digdugEnvironmnents`, that will display all
the environments provided by a remote testing service.

```
$ ./node_modules/.bin/digdugEnvironments SauceLabsTunnel
{"platform":"OS X 10.9","browserName":"firefox","version":"4"}
{"platform":"OS X 10.9","browserName":"firefox","version":"5"}
{"platform":"OS X 10.9","browserName":"firefox","version":"6"}
{"platform":"OS X 10.9","browserName":"firefox","version":"7"}
{"platform":"OS X 10.9","browserName":"firefox","version":"8"}
{"platform":"OS X 10.9","browserName":"firefox","version":"9"}
{"platform":"OS X 10.9","browserName":"firefox","version":"10"}
...
```

Note that BrowserStackTunnel requires that the `BROWSERSTACK_ACCESS_KEY` and
`BROWSERSTACK_USERNAME` environment variables exist and are set to a user’s
account access key and username. The other tunnels do not (currently) require
authentication to request an environment list.

## More information

-   [API documentation](https://theintern.io/docs.html#Dig%20Dug/2/api/BrowserStackTunnel)

<!-- start-github-only -->

## License

Dig Dug is a JS Foundation project offered under the [New BSD](LICENSE) license.

© [SitePen, Inc.](http://sitepen.com) and its
[contributors](https://github.com/theintern/digdug/graphs/contributors)

<!-- end-github-only -->

<!-- doc-viewer-config
{
    "api": "docs/api.json"
}
-->

[nulltunnel]: https://theintern.io/docs.html#Dig%20Dug/2/api/NullTunnel
[seleniumtunnel]: https://theintern.io/docs.html#Dig%20Dug/2/api/SeleniumTunnel
[tunnel]: https://theintern.io/docs.html#Dig%20Dug/2/api/Tunnel
