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

SUPPORT_DIR=$(cd $(dirname $0) && pwd)
ROOT_DIR="$SUPPORT_DIR/.."
BUILD_DIR="$ROOT_DIR/build_doc"

cd "$ROOT_DIR"
git clone -b gh-pages . "$BUILD_DIR"
jsdoc -c "$SUPPORT_DIR/jsdoc.conf" -d "$BUILD_DIR" --verbose *.js README.md

cd "$BUILD_DIR"
git add .
git commit -a -m "Rebuild documentation"
git push origin gh-pages

cd "$ROOT_DIR"
rm -rf "$BUILD_DIR"
