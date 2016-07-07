#!/usr/bin/env bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo Starting self tests...
cd ${DIR}/..
./node_modules/.bin/intern-client config=tests/intern
