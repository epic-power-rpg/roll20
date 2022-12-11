#! /bin/bash

set -eux -o pipefail

currentDirectory=$(dirname "${BASH_SOURCE:-$0}")

targetDirectory="${currentDirectory}/bin/"

mkdir -p "${targetDirectory}"

find "${currentDirectory}/ui/scripts" -name '*.js' -exec cat {} \; > "${targetDirectory}/roll20.js"

echo "Done"

