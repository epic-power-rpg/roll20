#! /bin/bash

set -eux -o pipefail

currentDirectory=$(dirname "${BASH_SOURCE:-$0}")

find "${currentDirectory}/ui/scripts" -name '*.js' -exec cat {} \; > "${currentDirectory}/ui/bin/roll20.js"

echo "Done"

