# Roll20 Epic Power RPG Files

Configuration files for Epic Power RPG files for <https://roll20.net>

# Setup

Run `make development-config`

## Install packages

1. Install `yarn`: <https://classic.yarnpkg.com/en/docs/getting-started>
2. In this directory, run `yarn`

## Formatting Files

In VSCode, and most editors, the editor will auto-detect some base level formatting.
Ideally, the linter will auto-format, but manually, you may need to set your editor to
`Spaces: 2` or similar

### Autolint JavaScript Files

1. Run `yarn lint:all` or `yarn lint:all-fix`

## Generate files for Roll20

It is useful to split scripts up into separate files for ease of development, however,
it is easier to copy just one script to Roll20.
In order to simplify this process, use the following to generate `./ui/bin/roll20.js` script
that is a combination of all scripts.

Any of the following will merge scripts:

* `yarn mergeScripts`
* `./mergeScripts.sh`
* `git commit` runs the above script as a pre-commit hook

