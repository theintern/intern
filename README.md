<p align="center"><img src="docs/logo.svg" alt="Intern logo" height="128"></p>

# Intern

> Software testing for humans

[![Build Status](https://travis-ci.org/theintern/intern.svg?branch=master)](https://travis-ci.org/theintern/intern)
[![codecov](https://codecov.io/gh/theintern/intern/branch/master/graph/badge.svg)](https://codecov.io/gh/theintern/intern)
[![Average time to resolve an issue](http://isitmaintained.com/badge/resolution/theintern/intern.svg)](http://isitmaintained.com/project/theintern/intern "Average time to resolve an issue")
[![Percentage of issues still open](http://isitmaintained.com/badge/open/theintern/intern.svg)](http://isitmaintained.com/project/theintern/intern "Percentage of issues still open")
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bhttps%3A%2F%2Fgithub.com%2Ftheintern%2Fintern.svg?type=shield)](https://app.fossa.io/projects/git%2Bhttps%3A%2F%2Fgithub.com%2Ftheintern%2Fintern?ref=badge_shield)

Intern is a complete test system for JavaScript designed to help you write and run consistent, high-quality test
cases for your JavaScript libraries and applications. It can be used to test _any_ JavaScript code. It can even be used
to test [non-JavaScript Web and mobile apps](https://theintern.github.io/intern/#native-apps), and to run tests written
for [other test systems](https://theintern.github.io/intern/#custom-interfaces).

If you’re into name-dropping, Intern gets used every day by teams at Twitter, Stripe, Mozilla, IBM, Marriott, Philips,
Zenput, Alfresco, Esri, HSBC, ING, Intuit, and more. It’s also the testing framework of choice for
[growing numbers of open-source projects](https://github.com/search?p=2&q=tests+filename%3Aintern.js&ref=searchresults&type=Code&utf8=%E2%9C%93).

**Note that this documentation is for Intern 4 master, which is currently an alpha release.**

* For the latest stable (Intern 3) release docs, please see [the Intern Guide](https://theintern.github.io/intern).
* For the latest unstable (Intern 4) release docs, please see [the release README](https://github.com/theintern/intern/tree/4.0.0-alpha.5).

## Quick start

1. Install from npm

    ```sh
    $ cd /my/project/root
    $ npm install intern@next
    ```

2. Create an `intern.json` file in your project root.

    ```js
    {
      "suites": "tests/unit/**/*.js"
    }
    ```

3. Verify that your configuration works by running Intern and checking that no errors are output.

    ```sh
    $ node_modules/.bin/intern
    ```

4. Start [writing tests](docs/writing_tests.md)!

## More information

* [How To](docs/how_to.md) - quick answers to common questions
* [Concepts](docs/concepts.md) - testing concepts and definitions
* [Configuration](docs/configuration.md) - how to configure Intern
* [Running](docs/running.md) - how to run Intern
* [Writing Tests](docs/writing_tests.md) - the various ways of writing tests with Intern
* [Architecture](docs/architecture.md) - how Intern is organized
* [API](docs/api.md) - Intern's API
* [Developing](docs/developing.md) - for Intern developers
* [Contributing](CONTRIBUTING.md) - how to contribute to Intern development

## Get help

The best place to ask questions and get answers about Intern is Stack Overflow. Just tag your question with `intern`.
If you have more immediate questions, or just want to chat with other people interested in Intern, there’s an `#intern`
IRC channel on freenode, and a Gitter room at [theintern/intern](https://gitter.im/theintern/intern). See the
[Help](docs/help.md) page for more information.

## License

Intern is a JS Foundation project offered under the [New BSD](LICENSE) license.

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bhttps%3A%2F%2Fgithub.com%2Ftheintern%2Fintern.svg?type=large)](https://app.fossa.io/projects/git%2Bhttps%3A%2F%2Fgithub.com%2Ftheintern%2Fintern?ref=badge_large)

© [SitePen, Inc.](http://sitepen.com) and its [contributors](https://github.com/theintern/intern/graphs/contributors)

<p align="center">Intern’s self-tests run on<br>
<a href="https://browserstack.com"><img alt="BrowserStack logo" src="https://theintern.github.io/images/browserstack.svg" height="32" align="middle"></a></p>
