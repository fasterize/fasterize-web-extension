const fs = require('fs');
const childProcess = require('child_process');
const fsExtra = require('fs-extra');
// update version
const version = process.argv[2];

if (
    !version ||
    !process.env['MOZILLA_API_KEY'] ||
    !process.env['MOZILLA_API_SECRET'] ||
    !process.env['GITHUB_TOKEN']
) {
    console.log(`
Usage: MOZILLA_API_KEY=X \
MOZILLA_API_SECRET=X \
GITHUB_TOKEN=X \
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
    update_link: `https://github.com/fasterize/fasterize-web-extension/releases/download/${version}/fasterize_status-${version}.xpi`,
});
fs.writeFileSync(appUpdateManifestLocation, JSON.stringify(appUpdateManifest, null, 2));

console.log('-> update README');
let readme = fs.readFileSync('./README.md');
readme = readme
    .toString()
    .replace(
        /\[Firefox\]\(.*\)/,
        `[Firefox](https://github.com/fasterize/fasterize-web-extension/releases/download/${version}/fasterize_status-${version}.xpi)`
    );
fs.writeFileSync(readmeLocation, readme);

console.log(`-> commit changes, tag with the version ${version}`);
childProcess.execSync(`git commit -a -m "Bump to ${version}"`);
childProcess.execSync(`git tag ${version}`);
childProcess.execSync(`GITHUB_TOKEN=${process.env['GITHUB_TOKEN']} git push origin --tags && git push`);

console.log('-> publish on Chrome Web Store');
childProcess.execSync('grunt', {stdio: 'inherit'});

console.log('-> sign addon on Mozilla Addon Store');
fsExtra.copySync('app', 'tmp');
const appManifestFirefox = require('./tmp/manifest.json');
// incognito split is not allowed on firefox.
delete appManifestFirefox.incognito;
// Firefox can open popup with openPopup() method. And we need to ask permission to access all urls.
appManifestFirefox.action = {
    "default_title": "Fasterize",
    "default_icon": "icons/store/icon.png"
};
// Firefox not support yet the service worker
appManifestFirefox.background = {
    "scripts": [
        "mapping.js",
        "frz-request.js",
        "main.js"
    ]
};
// Chrome not support browser_specific_settings
appManifestFirefox.browser_specific_settings = {
    "gecko": {
        "id": "{c1687a9a-9054-430e-94cf-2ef9b3caeb7b}",
        "update_url": "https://raw.githubusercontent.com/fasterize/fasterize-web-extension/master/app/update-manifest.json",
        "strict_min_version": "48.0"
    }
}
fs.writeFileSync('./tmp/manifest.json', JSON.stringify(appManifestFirefox, null, 2));

childProcess.execSync('npx web-ext -a dist/firefox -s tmp build --overwrite-dest', {stdio: 'inherit'});
childProcess.execSync(
    `npx web-ext -a dist/firefox -s tmp sign --api-key=${process.env['MOZILLA_API_KEY']} \
  --api-secret=${process.env['MOZILLA_API_SECRET']} --timeout 600000`,
    {stdio: 'inherit'}
);

console.log('-> publish mozilla addon on Github releases');
childProcess.execSync(
    `GITHUB_TOKEN=${process.env['GITHUB_TOKEN']} hub release create -a dist/firefox/fasterize_status-${version}.xpi -m "Release ${version}" ${version}`,
    {stdio: 'inherit'}
);
