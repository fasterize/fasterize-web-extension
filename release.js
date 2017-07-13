const fs = require('fs');
const childProcess = require('child_process');

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
CHROME_WEBSTORE_SECRET=X \
node release.js version`);
  process.exit(1);
}

const packageLocation = './package.json';
const appManifestLocation = './app/manifest.json';
const appUpdateManifestLocation = './app/update-manifest.json';

// update package.json
const package = require(packageLocation);
package.version = version;
fs.writeFileSync(packageLocation, JSON.stringify(package, null, 2));

// update manifest.json
const appManifest = require(appManifestLocation);
appManifest.version = version;
fs.writeFileSync(appManifestLocation, JSON.stringify(appManifest, null, 2));

// update update-manifest.json
const appUpdateManifest = require(appUpdateManifestLocation);
const key = Object.keys(appUpdateManifest.addons)[0];
appUpdateManifest.addons[key].updates.push({
  version: version,
  update_link: `https://github.com/fasterize/fasterize-web-extension/releases/download/${version}/fasterize_status-${version}-an+fx.xpi`,
});
fs.writeFileSync(appUpdateManifestLocation, JSON.stringify(appUpdateManifest, null, 2));

// commit new version
childProcess.execSync(`git commit -a -m "Bump to ${version}"`);
childProcess.execSync(`git tag ${version}`);
childProcess.execSync(`git push origin --tags`);
// release to Chrome Web Store
childProcess.execSync('gulp');

// release to Mozilla Add-on Store
childProcess.execSync('web-ext -a dist/firefox -s app build --overwrite-dest');
childProcess.execSync(`web-ext -a dist/firefox -s app sign --api-key=${process.env['MOZILLA_API_KEY']} \
  --api-secret=${process.env['MOZILLA_API_SECRET']}`);
childProcess.execSync(`hub release create -a dist/firefox/fasterize_status-${version}-an+fx.xpi -m "test" ${version}`);
