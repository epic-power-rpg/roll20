const pug = require('pug');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const chokidar = require('chokidar');
const { html: beautifyHtml } = require('js-beautify');

const beautifyOptions = {
  unformatted: [],
  inline: [],
  indent_inner_html: true,
  indent_char: ' ',
  indent_size: 2,
  sep: '\n',
  // wrap_line_length: '80',
  max_preserve_newlines: '2',
  preserve_newlines: true,
  end_with_newline: true,
};

const { argv } = yargs
  .option('watch', {
    alias: 'w',
    description: 'Watch for pug changes',
  })
  .help();

function renderHtml() {
  try {
    const html = pug.renderFile(`${__dirname}/main.pug`, { pretty: '  ' });
    const prettyHtml = beautifyHtml(html, beautifyOptions);
    const outputFilename = path.normalize(`${__dirname}/../bin/main.html`);
    fs.writeFileSync(outputFilename, prettyHtml);
    console.log(`Wrote ${outputFilename}`);
  } catch (error) {
    console.error(error);
  }
}

if (argv.watch) {
  const watcher = chokidar.watch(`${__dirname}/**/*.{html,pug}`, {
    persistent: true
  });
  watcher.on('ready', renderHtml);
  watcher.on('change', (filename) => {
    console.log(`${filename} changed`);
    renderHtml();
  });
} else {
  renderHtml();
}
