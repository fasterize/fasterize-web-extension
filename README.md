# Fasterize Status

Chrome and Firefox web extension for Fasterize

[![Latest version][badge-cws]][link-cws]

[badge-cws]: https://img.shields.io/chrome-web-store/v/pophpmnchlcddhhilmnopbahlaohdfig.svg?label=latest%20version
[link-cws]: https://chrome.google.com/webstore/detail/fasterize-status/pophpmnchlcddhhilmnopbahlaohdfig 'Version published on Chrome Web Store'

# Install

- [Firefox](https://github.com/fasterize/fasterize-web-extension/releases/download/3.4.10/fasterize_status-3.4.10-an+fx.xpi)
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

# Release

You need to have `hub` installed to do the release and grunt `npm install -g grunt`

On OSX, just run `brew install hub`. On Ubuntu :

```
sudo add-apt-repository ppa:cpick/hub
sudo apt-get update
sudo apt-get install hub
```

The command `npm run release` publish on Chrome Web Store and sign the extension on Mozilla Addon Store. The firefox extension is released on github.

    MOZILLA_API_KEY=X MOZILLA_API_SECRET=X CHROME_WEBSTORE_ID=X CHROME_WEBSTORE_SECRET=X CHROME_WEBSTORE_REFRESH=X node release.js {version}

Note : A note on lastpass contains the credentials
