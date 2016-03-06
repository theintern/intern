#!/usr/bin/env bash

echo "This is an internal Leadfoot maintenance script. It updates the"
echo "API documentation in the gh-pages branch."
echo ""
echo "If you want to update the API docs, press 'y'."
read -s -n 1

if [ "$REPLY" != "y" ]; then
	echo "Aborted."
	exit 0
fi

function createRedirectFile {
	local name
	local new_file

	name=$1
	new_file=$2
	title=$3

	if [[ -z $title ]]; then
		title=$name
	fi

	echo "<!DOCTYPE html>
<html lang=\"en\">
<head>
	<meta charset=\"utf-8\">
	<title>Leadfoot docs: Module: leadfoot/${title}</title>
	<link rel=\"stylesheet\" href=\"styles/catalyst.css\">
	<style>
		p { margin: 2em; font-size: 120%; }
	</style>
</head>
<body>
	<p>This page has moved to <a id=\"redirect\" href=\"${new_file}\">${new_file}</a>.</p>
	<script>
		// Update the redirect URL with this page's hash fragment. This isn't guaranteed to work as anchor IDs may have changed.
		var redirect = document.getElementById('redirect');
		redirect.href += location.hash;
	</script>
</body>
</html>" > ${name}.html
}

SUPPORT_DIR=$(cd $(dirname $0) && pwd)
ROOT_DIR=$(cd "$SUPPORT_DIR/.." && pwd)
BUILD_DIR="$ROOT_DIR/build_doc"

cd "$ROOT_DIR"
git clone -b gh-pages . "$BUILD_DIR"
cd "$BUILD_DIR"
git rm -r '*'
cd "$ROOT_DIR"
jsdoc -c "$SUPPORT_DIR/jsdoc.conf" -t "../jsdoc-theme/catalyst/" -d "$BUILD_DIR" --verbose *.js helpers/*.js README.md
cd "$BUILD_DIR"

# Create stub files for modules that have been renamed due to jsdoc's namespacing rules
for name in Command Element Server Session compat keys; do
	createRedirectFile $name module-leadfoot_${name}.html
done
createRedirectFile pollUntil module-leadfoot_helpers_pollUntil.html "helpers/pollUntil"
createRedirectFile pollUntil.js helpers_pollUntil.js.html "helpers/pollUntil.js"

git add -A
git commit -a -m "Rebuild documentation"
git push origin gh-pages

cd "$ROOT_DIR"
rm -rf "$BUILD_DIR"
