# FAQ

<!-- vim-markdown-toc GFM -->
* [How do I use modifier keys?](#how-do-i-use-modifier-keys)
* [How can I keep the test page open?](#how-can-i-keep-the-test-page-open)
* [How do I test locally with multiple browsers?](#how-do-i-test-locally-with-multiple-browsers)

<!-- vim-markdown-toc -->

## How do I use modifier keys?

Import the [`leadfoot/keys`](https://theintern.github.io/leadfoot/module-leadfoot_keys.html) module and use its constants with the `pressKeys` method. For example, to send `Shift + Click` to the browser:

    require([
      'intern!object',
      'chai!assert',
      'intern/dojo/node!leadfoot/keys'
    ], function (registerSuite, assert, keys) {
      registerSuite({
        name: 'test',
        'test1': function () {
          var remote = this.remote();
          return remote.get('testpage.html')
            .elementById('testLink')
            .pressKeys(keys.SHIFT)
            .clickElement()
            // Release all currently pressed modifier keys
            .pressKeys(keys.NULL)
            .end();
        }
      });
    });

## How can I keep the test page open?

Use Intern’s `leaveRemoteOpen` command line option to keep the browser open after testing is complete:

    intern-runner config=myPackage/test/intern leaveRemoteOpen

## How do I test locally with multiple browsers?

1.  Setup a [local WebDriver server](https://theintern.github.io/intern/#local-selenium).
2.  Configure the [`environments`](https://theintern.github.io/intern/#option-environments) section of your Intern config to use multiple target browsers:

        environments: [
          { browserName: 'chrome' },
          { browserName: 'internet explorer' }
        ]

3.  Start your WebDriver server: java -jar selenium-server-standalone-2.53.0.jar
4.  Run Intern: intern-runner config=myPackage/test/intern

