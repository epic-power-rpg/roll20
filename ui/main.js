const pug = require('pug');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const chokidar = require('chokidar');

const { argv } = yargs
  .option('watch', {
    alias: 'w',
    description: 'Watch for pug changes',
  })
  .help();

function renderHtml() {
  const html = pug.renderFile(`${__dirname}/main.pug`, { pretty: '  ' });
  const outputFilename = path.normalize(`${__dirname}/../bin/main.html`);
  fs.writeFileSync(outputFilename, html);
  console.log(`Wrote ${outputFilename}`);
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
