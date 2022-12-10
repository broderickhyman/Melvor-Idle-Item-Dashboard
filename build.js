const archiver = require('archiver');
//const copydir = require('copy-dir');
const fs = require('fs');
const path = require('path');

//copydir.sync('styles', 'dist/styles');
//copydir.sync('icons', 'dist/icons');

const { version } = require('./package.json');
// copy manifest.json
const manifest = JSON.parse(fs.readFileSync('manifest.json').toString());
manifest.version = version
fs.writeFileSync('build/manifest.json', JSON.stringify(manifest, null, 4));

const zipName = path.join(__dirname, 'dist', `MIID-v${version}.zip`);
console.log(zipName)
fs.mkdirSync(path.dirname(zipName), { recursive: true });

const output = fs.createWriteStream(zipName);
const archive = archiver('zip');
archive.pipe(output);

archive.directory('build', '');

if (require.main === module) {
  archive.finalize();
}
exports.zipName = zipName;
exports.archive = archive;

console.log(version);
console.log(new Date());