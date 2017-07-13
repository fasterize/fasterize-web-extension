# Fasterize Status

Chrome and Firefox web extension for Fasterize

[![Latest version][badge-cws]][link-cws]

  [badge-cws]: https://img.shields.io/chrome-web-store/v/pophpmnchlcddhhilmnopbahlaohdfig.svg?label=for%20chrome
  [link-cws]: https://chrome.google.com/webstore/detail/fasterize-status/pophpmnchlcddhhilmnopbahlaohdfig "Version published on Chrome Web Store"

# Install

 * [Firefox](release)
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

  $ npm run dev:firefox

Debugging : go to `about:debugging#addons`.
Reference is https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Debugging

# Distribution

## Chrome

The following command will publish the new version of the extension on the Chrome store.

  $ npm run publish:chrome

## Firefox

The following command will create a .xpi archive that contains the extension.
This extension cannot be published on the mozilla store because the extension is linked to a paying service.

  $ npm run publish:firefox
