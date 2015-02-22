#!/usr/bin/env bash
stylus --inline -c -u nib/lib/nib main.styl
uglifyjs --screw-ie8 -m -c -- highlight.pack.js main.js > main.min.js
