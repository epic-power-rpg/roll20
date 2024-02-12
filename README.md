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

1. Run `yarn lint:all` or `yarn lint:fix-all`

## Generate files for Roll20

### Scripts

It is useful to split scripts up into separate files for ease of development, however,
it is easier to copy just one script to Roll20.
In order to simplify this process, use the following to generate `./bin/roll20.js` script
that is a combination of all scripts.

#### Pug

[pug](https://pugjs.org/api/getting-started.html) is a tool that provides the ability to template and
compile HTML from individual `pug` files.

To generate html:

* In development, `yarn pug:watch`
* In build systems: `yarn pug`

The output is in `./bin/main.html`

#### CSS

[Sass](https://sass-lang.com/guide) is a tool that provides the ability to compile CSS from individual
SCSS files.
It provides a number of useful tools like defining variables and nesting, along with
compile time error checking and auto-formatting.

To generate CSS:

* In development, `yarn sass:watch`
* In build systems: `yarn sass`

The output is in `./bin/main.css`

#### Build HTML and CSS

* Run `yarn build:all` to build html and css.

### Roll 20 admin scripts

This project has scripts for handling custom rolling code.

Any of the following will merge scripts:

* `yarn mergeScripts`
* `./mergeScripts.sh`
* `git commit` runs the above script as a pre-commit hook

The output is in `./bin/roll20.js`
