// Check chrome
if (typeof browser === "undefined") {
    try {
        importScripts( "mapping.js", "frz-request.js");
    } catch (e) {
        console.log(e);
    }
} else {
    // To ask " Access your data for all websites " permission on Firefox
    browser.permissions.getAll().then((permissions) => {
        if(permissions.origins.indexOf("<all_urls>") === -1){
            browser.action.onClicked.addListener(async (tab) => {
                console.log('Fasterize extension : request permission');
                browser.permissions.request({origins: ['<all_urls>']})
            });
        }
    });
}


const processCompletedRequest = (details) => {
    console.log('Fasterize extension : processCompletedRequest');
    // Utilisez chrome.storage.local dans Chrome et browser.storage.local dans Firefox
    const storage = (typeof browser === "undefined") ? chrome.storage.local : browser.storage.local;

    const request = new FRZRequest(details);
    storage.set({[details.tabId]: details}, () => {
        request.setPageActionIconAndPopup();
    });
};
const filter = {
    urls: ['http://*/*', 'https://*/*'],
    types: ['main_frame'],
};

const extraInfoSpec = ['responseHeaders'];

// Utilisez `chrome` pour Chrome et `browser` pour Firefox
const webRequest = typeof chrome !== 'undefined' ? chrome.webRequest : browser.webRequest;
const tabs = typeof chrome !== 'undefined' ? chrome.tabs : browser.tabs;
const runtime = typeof chrome !== 'undefined' ? chrome.runtime : browser.runtime;

webRequest.onCompleted.addListener(processCompletedRequest, filter, extraInfoSpec);

let shouldDisableFasterizeCache = false;

// Utilisez le bon objet pour accéder au stockage
const storage = typeof chrome !== 'undefined' ? chrome.storage.local : browser.storage.local;

storage.get('disable-fasterize-cache', (res) => {
    shouldDisableFasterizeCache = res['disable-fasterize-cache'] || false;
});

webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        if (shouldDisableFasterizeCache) {
            details.requestHeaders.push({
                name: 'Cache-Control',
                value: 'no-fstrz-cache',
            });
            details.requestHeaders.push({name: 'X-Frz-Nocache', value: Date.now().toString()});
        }
        return {requestHeaders: details.requestHeaders};
    },
    filter,
    ['requestHeaders']
);

tabs.onReplaced.addListener((addedTabId, removedTabId) => {
    storage.get(removedTabId.toString(), (result) => {
        if (result[removedTabId]) {
            const request = result[removedTabId];
            storage.set({[addedTabId]: request});
            storage.remove([removedTabId.toString()]);
        } else {
            console.log('Could not find an entry in storage when replacing ', removedTabId);
        }
    });
});

runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'update-settings') {
        shouldDisableFasterizeCache = request['disable-fasterize-cache'];
        storage.set({'disable-fasterize-cache': shouldDisableFasterizeCache});
    }
});

tabs.onRemoved.addListener((tabId) => {
    storage.remove([tabId.toString()]);
});