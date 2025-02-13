# Fasterize Status

Chrome and Firefox web extension for Fasterize

[![Latest version][badge-cws]][link-cws]

[badge-cws]: https://img.shields.io/chrome-web-store/v/pophpmnchlcddhhilmnopbahlaohdfig.svg?label=latest%20version
[link-cws]: https://chrome.google.com/webstore/detail/fasterize-status/pophpmnchlcddhhilmnopbahlaohdfig 'Version published on Chrome Web Store'

# Install

- [Firefox](https://github.com/fasterize/fasterize-web-extension/releases/download/4.2.0/fasterize_status-4.2.0.xpi)
- [Chrome](https://chrome.google.com/webstore/detail/fasterize-status/pophpmnchlcddhhilmnopbahlaohdfig)

# Dev

    npm install && npm run dev

## Chrome

Load the `app` directory into chrome (go to chrome://extensions/ and click on "Load unpacked extension").
You can also install [Extension Reloader](https://chrome.google.com/webstore/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid) to perform live-reloading.

Debugging : go to `chrome://extensions`

Reference is https://developer.chrome.com/extensions/tut_debugging

The developper dashboard is https://chrome.google.com/webstore/devconsole/d47c0dfe-54f9-41c3-a785-e868a9854aa6
https://console.cloud.google.com/apis/credentials?project=extension-chrome-344315&supportedpurview=project
https://developer.chrome.com/docs/webstore/using_webstore_api/

## Firefox

This will launch a standalone firefox with the installed extension. The extension is compatible from Firefox 48.

Debugging : go to `about:debugging#addons`.

Reference is https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Debugging

You need to generate a github personal access token with your github account.
https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

# Release

### 1. Prerequisite
You need to have `hub` installed to do the release and grunt `npm install -g grunt`

On OSX, just run `brew install hub`. On Ubuntu :

```
sudo add-apt-repository ppa:cpick/hub
sudo apt-get update
sudo apt-get install hub
```

The command `npm run release` publish on Chrome Web Store and sign the extension on Mozilla Addon Store. The firefox extension is released on github.    

### 2. Manifest
The release script will <b>automatically</b> change manisfest.json. Because Firefox doesn't support "service_worker" but chrome needs it for Manifest V3.

Manifest for firefox : 
``
"action": {
"default_title": "Fasterize",
"default_icon": "icons/store/icon.png"
},
"background": {
"scripts": [
"mapping.js",
"frz-request.js",
"main.js"
]
},
"browser_specific_settings": {
"gecko": {
"id": "{c1687a9a-9054-430e-94cf-2ef9b3caeb7b}",
"update_url": "https://raw.githubusercontent.com/fasterize/fasterize-web-extension/master/app/update-manifest.json",
"strict_min_version": "58.0"
}
}``


Manifest for chrome :
``
"action": {
"default_popup": "popup/popup.html",
"default_title": "Fasterize",
"default_icon": "icons/store/icon.png"
},
"background": {
"service_worker": "main.js"
}``

### 3. Release
This command will sign the extension on Mozilla Addon Store. The firefox extension is released on github. The chrome extension is not directly published on Chrome Web Store.
It will create a build and a zip file in the `dist/chrome` directory. You have to publish the zip file on the Chrome Web Store manually at https://chrome.google.com/webstore/devconsole/d47c0dfe-54f9-41c3-a785-e868a9854aa6
 
```
MOZILLA_API_KEY=X MOZILLA_API_SECRET=X GITHUB_TOKEN=X node release.js {version}
```

