# How To...

<!-- vim-markdown-toc GFM -->

* [Use Leadfoot as a standalone library](#use-leadfoot-as-a-standalone-library)
* [Use Leadfoot with async/await](#use-leadfoot-with-asyncawait)
* [How to iterate through elements](#how-to-iterate-through-elements)

<!-- vim-markdown-toc -->

## Use Leadfoot as a standalone library

1. Install leadfoot in your project
   ```
   npm install @theintern/leadfoot
   ```
2. Create a Server — this manages communication between your app and a remote WebDriver server
   ```js
   import Server from '@theintern/leadfoot/Server'
   const server = new Server('http://my-webdriver-server.local');
   ```
3. Create a new session — this is a connection to a remote browser
   ```js
   const session = server.createSession({ "browserName": "chrome" });
   ```
4. Create a Command — this is what your app will use to call WebDriver commands
   ```js
   import Command from '@theintern/leadfoot/Command'
   const command = new Command(session);
   ```
5. Start talking to the browser
   ```js
   command.get('http://theintern.io')
       .findByTagName('h1')
       // ...
    ```

## Use Leadfoot with async/await

Leadfoot is Promise-based, so it works very well with async/await.

```js
const page = await command.get('http://page.local');
const form = await page.findById('login-form');
await form.findByCssSelector('[name="username"]').type('bob');
await form.findByCssSelector('[name="password"]').type('12345');
await form.findByCssSelector('.submit').click()
```

## How to iterate through elements

Using `Array.reduce`:

```js
command
    .findAllByTagName('h1')
    .then(headings => {
        return headings.reduce((textsPromise, heading) => {
            return textsPromise.then(texts => {
                return heading.getText().then(text => {
                    return texts.concat(text);
                });
            });
        }, Promise.resolve([]));
    });
```

Using async/await:

```js
command
    .findAllByTagName('h1')
    .then(async headings => {
        const texts = [];
        for (const heading of headings) {
            texts.push(await heading.getVisibleText());
        }
        return texts;
    });
```

Since Leadfoot element methods will work on arrays as well as individual found elements, in this case one could also simply do:

```js
command
    .findByTagName('h1')
    .getVisibleText()
```
