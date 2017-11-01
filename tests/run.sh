#!/usr/bin/env bash
cd "$(dirname $0)/.."
node_modules/.bin/intern-client config=_build/tests/intern reporters=Combined $@
node_modules/.bin/intern-runner config=_build/tests/intern reporters=Combined $@
