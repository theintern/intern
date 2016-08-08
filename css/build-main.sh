#!/usr/bin/env bash
cd "$(dirname "$0")"
stylus --inline -c -u nib -o . main.styl
uglifyjs --screw-ie8 -m -c -- highlight.pack.js main.js > main.min.js
