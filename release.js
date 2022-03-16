const fs = require('fs');
const childProcess = require('child_process');
const fsExtra = require('fs-extra');
// update version
const version = process.argv[2];

if (
  !version ||
  !process.env['MOZILLA_API_KEY'] ||
  !process.env['MOZILLA_API_SECRET'] ||
  !process.env['CHROME_WEBSTORE_ID'] ||
  !process.env['CHROME_WEBSTORE_SECRET'] ||
  !process.env['CHROME_WEBSTORE_REFRESH']
) {
  console.log(`
Usage: MOZILLA_API_KEY=X \
MOZILLA_API_SECRET=X \
CHROME_WEBSTORE_ID=X \
CHROME_WEBSTORE_SECRET=X \
CHROME_WEBSTORE_REFRESH=X \
node release.js {version}`);
  process.exit(1);
}

const packageLocation = './package.json';
const packageLockLocation = './package-lock.json';
const appManifestLocation = './app/manifest.json';
const appUpdateManifestLocation = './app/update-manifest.json';
const readmeLocation = './README.md';

console.log('-> update package.json');
const package = require(packageLocation);
package.version = version;
fs.writeFileSync(packageLocation, JSON.stringify(package, null, 2));

console.log('-> update package-lock.json');
const packageLock = require(packageLockLocation);
packageLock.version = version;
fs.writeFileSync(packageLockLocation, JSON.stringify(packageLock, null, 2));

console.log('-> update manifest.json');
const appManifest = require(appManifestLocation);
appManifest.version = version;
fs.writeFileSync(appManifestLocation, JSON.stringify(appManifest, null, 2));

console.log('-> update update-manifest.json');
const appUpdateManifest = require(appUpdateManifestLocation);
const key = Object.keys(appUpdateManifest.addons)[0];
appUpdateManifest.addons[key].updates.push({
  version: version,
  update_link: `https://github.com/fasterize/fasterize-web-extension/releases/download/${version}/fasterize_status-${version}-an+fx.xpi`,
});
fs.writeFileSync(appUpdateManifestLocation, JSON.stringify(appUpdateManifest, null, 2));

console.log('-> update README');
let readme = fs.readFileSync('./README.md');
readme = readme
  .toString()
  .replace(
    /\[Firefox\]\(.*\)/,
    `[Firefox](https://github.com/fasterize/fasterize-web-extension/releases/download/${version}/fasterize_status-${version}-an+fx.xpi)`
  );
fs.writeFileSync(readmeLocation, readme);

console.log(`-> commit changes, tag with the version ${version}`);
childProcess.execSync(`git commit -a -m "Bump to ${version}"`);
childProcess.execSync(`git tag ${version}`);
childProcess.execSync(`git push origin --tags && git push`);

console.log('-> publish on Chrome Web Store');
childProcess.execSync('npx grunt');

console.log('-> sign addon on Mozilla Addon Store');
fsExtra.copySync('app', 'tmp');
const appManifestFirefox = require('./tmp/manifest.json');
// incognito split is not allowed on firefox.
delete appManifestFirefox.incognito;
fs.writeFileSync('./tmp/manifest.json', JSON.stringify(appManifestFirefox, null, 2));

childProcess.execSync('npx web-ext -a dist/firefox -s tmp build --overwrite-dest');
childProcess.execSync(`npx web-ext -a dist/firefox -s tmp sign --api-key=${process.env['MOZILLA_API_KEY']} \
  --api-secret=${process.env['MOZILLA_API_SECRET']} --timeout 600000`);

console.log('-> publish mozilla addon on Github releases');
childProcess.execSync(
  `hub release create -a dist/firefox/fasterize_status-${version}-an+fx.xpi -m "Release ${version}" ${version}`
);
