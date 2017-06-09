# How To...

## Run Intern in my own test page in a browser

Load the `browser/intern.js` bundle in a page using a script tag. This will create an `intern` global that can be used
to configure Intern and start tests.

```html
<!DOCTYPE html>
	<head>
		<script src="node_modules/intern/browser/intern.js"></script>
        <script>
            intern.config({ suites: [
                'tests/unit/a.js',
                'tests/unit/b.js'
            ]});
            intern.run();
        </script>
	</head>
	<body>
	</body>
</html>
```
