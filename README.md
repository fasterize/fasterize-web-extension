# Fasterize Status

Chrome and Firefox web extension for Fasterize

[![Latest version][badge-cws]][link-cws]

  [badge-cws]: https://img.shields.io/chrome-web-store/v/pophpmnchlcddhhilmnopbahlaohdfig.svg?label=latest%20version
  [link-cws]: https://chrome.google.com/webstore/detail/fasterize-status/pophpmnchlcddhhilmnopbahlaohdfig "Version published on Chrome Web Store"

# Install

 * [Firefox](https://github.com/fasterize/fasterize-web-extension/releases/download/1.3.7/fasterize_status-1.3.7-an.fx.xpi)
 * [Chrome](https://chrome.google.com/webstore/detail/fasterize-status/pophpmnchlcddhhilmnopbahlaohdfig)

# Dev
    npm install && npm run dev

## Chrome

Load the `app` directory into chrome (go to chrome://extensions/ and click on "Load unpacked extension").
You can also install (Extension Reloader)[https://chrome.google.com/webstore/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid] to perform live-reloading.

Debugging : go to `chrome://extensions`
Reference is https://developer.chrome.com/extensions/tut_debugging

## Firefox

This will launch a standalone firefox with the installed extension.

Debugging : go to `about:debugging#addons`.
Reference is https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Debugging

# Release

The command `npm run release` publish on Chrome Web Store and sign the extension on Mozilla Addon Store. The firefox extension is released on github.

    MOZILLA_API_KEY=X MOZILLA_API_SECRET=X CHROME_WEBSTORE_ID=X CHROME_WEBSTORE_SECRET=X CHROME_WEBSTORE_REFRESH=X node release.js {version}
