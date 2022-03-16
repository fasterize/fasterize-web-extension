// a mapping of tab IDs to window.requests
window.requests = {};

// listen to all web requests and when request is completed, create a new
// Request object that contains a bunch of information about the request
const processCompletedRequest = details => {
  const request = new FRZRequest(details);
  window.requests[details.tabId] = request;
  setTimeout(() => {
    request.setPageActionIconAndPopup();
  }, 300);
};

const filter = {
  urls: ['http://*/*', 'https://*/*'],
  types: ['main_frame'],
};

const extraInfoSpec = ['responseHeaders'];

// start listening to all web window.requests
browser.webRequest.onCompleted.addListener(processCompletedRequest, filter, extraInfoSpec);

let shouldDisableFasterizeCache = false;

browser.storage.local.get('disable-fasterize-cache').then(res => {
  shouldDisableFasterizeCache = res['disable-fasterize-cache'];
});

browser.webRequest.onBeforeSendHeaders.addListener(
  details => {
    if (shouldDisableFasterizeCache) {
      details.requestHeaders.push({
        name: 'Cache-Control',
        value: 'no-fstrz-cache',
      });
      details.requestHeaders.push({ name: 'X-Frz-Nocache', value: Date.now().toString() });
    }
    return { requestHeaders: details.requestHeaders };
  },
  filter,
  ['blocking', 'requestHeaders']
);

// when a tab is replaced, usually when a request started in a background tab
// and then the tab is upgraded to a regular tab (becomes visible)
browser.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  if (removedTabId in window.requests) {
    window.requests[addedTabId] = window.requests[removedTabId];
    delete window.requests[removedTabId];
  } else {
    console.log('Could not find an entry in window.requests when replacing ', removedTabId);
  }
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'update-settings') {
    shouldDisableFasterizeCache = request['disable-fasterize-cache'];
  }
});

// clear request data when tabs are destroyed
browser.tabs.onRemoved.addListener(tabId => {
  delete window.requests[tabId];
});
