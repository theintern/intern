#!/usr/bin/env bash
uglifyjs --screw-ie8 -m -c -- highlight.pack.js main.js > main.min.js
