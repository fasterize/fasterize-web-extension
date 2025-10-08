// Check chrome
const isChrome = typeof browser === 'undefined';
const browserApi = isChrome ? chrome : browser;
if (isChrome) {
  try {
    importScripts('mapping.js', 'frz-request.js');
  } catch (e) {
    console.log(e);
  }
} else {
  // To ask " Access your data for all websites " permission on Firefox
  browser.permissions.getAll().then(permissions => {
    if (permissions.origins.indexOf('<all_urls>') === -1) {
      browser.action.onClicked.addListener(async tab => {
        console.log('Fasterize extension : request permission');
        browser.permissions.request({ origins: ['<all_urls>'] });
      });
    }
  });
}

const processCompletedRequest = details => {
  console.log('Fasterize extension : processCompletedRequest');
  const request = new FRZRequest(details);

  // Create a unique key for this tab+URL combination
  const tabUrlKey = `${details.tabId}_${details.url}`;

  // Add timestamp to details for freshness comparison
  const detailsWithTimestamp = {
    ...details,
    timestamp: Date.now(),
  };

  // Get the current tabs data
  browserApi.storage.local.get(['fasterize_tabs'], result => {
    const tabsData = result.fasterize_tabs || {};
    const existingData = tabsData[tabUrlKey];

    // Store if no existing data OR if new request is more recent
    if (!existingData || detailsWithTimestamp.timestamp > existingData.timestamp) {
      tabsData[tabUrlKey] = detailsWithTimestamp;

      // Clean up old entries (older than 1 hour)
      cleanupOldEntries(tabsData);

      browserApi.storage.local.set({ fasterize_tabs: tabsData }, () => {
        request.setPageActionIconAndPopup();
      });
    }
  });
};

// Clean up entries older than 1 hour to prevent storage bloat
function cleanupOldEntries(tabsData) {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  Object.keys(tabsData).forEach(key => {
    if (tabsData[key].timestamp < oneHourAgo) {
      delete tabsData[key];
    }
  });
}
const filter = {
  urls: ['http://*/*', 'https://*/*'],
  types: ['main_frame'],
};

const extraInfoSpec = ['responseHeaders'];

browserApi.webRequest.onCompleted.addListener(processCompletedRequest, filter, extraInfoSpec);

let shouldDisableFasterizeCache = false;

browserApi.storage.local.get('disable-fasterize-cache', res => {
  shouldDisableFasterizeCache = res['disable-fasterize-cache'] || false;
});

browserApi.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  // Get the current tabs data
  browserApi.storage.local.get(['fasterize_tabs'], result => {
    const tabsData = result.fasterize_tabs || {};
    const keysToUpdate = {};
    const keysToRemove = [];

    // Find all entries for the removed tab and migrate them to the new tab
    Object.keys(tabsData).forEach(key => {
      if (key.startsWith(`${removedTabId}_`)) {
        const url = key.substring(`${removedTabId}_`.length);
        const newKey = `${addedTabId}_${url}`;
        keysToUpdate[newKey] = tabsData[key];
        keysToRemove.push(key);
      }
    });

    // Update the tabs data
    keysToRemove.forEach(key => delete tabsData[key]);
    Object.assign(tabsData, keysToUpdate);

    // Save updated tabs data
    browserApi.storage.local.set({ fasterize_tabs: tabsData });
  });
});

browserApi.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'update-settings') {
    shouldDisableFasterizeCache = request['disable-fasterize-cache'];
    if (shouldDisableFasterizeCache) {
      browserApi.declarativeNetRequest.updateDynamicRules(
        {
          addRules: [
            {
              id: 1,
              priority: 1,
              action: {
                type: 'modifyHeaders',
                requestHeaders: [
                  { header: 'Cache-Control', operation: 'set', value: 'no-fstrz-cache' },
                  { header: 'X-Frz-Nocache', operation: 'set', value: Date.now().toString() },
                ],
              },
              condition: {
                urlFilter: '|http*',
                resourceTypes: ['main_frame'],
              },
            },
          ],
          removeRuleIds: [1],
        },
        result => {
          console.log('Fasterize extension : rule requestHeaders added', result);
        }
      );
    } else {
      browserApi.declarativeNetRequest.updateDynamicRules(
        {
          addRules: [],
          removeRuleIds: [1],
        },
        result => {
          console.log('Fasterize extension : rule requestHeaders deleted', result);
        }
      );
    }
    browserApi.storage.local.set({ 'disable-fasterize-cache': shouldDisableFasterizeCache });
  }
});

browserApi.tabs.onRemoved.addListener(tabId => {
  // Get the current tabs data
  browserApi.storage.local.get(['fasterize_tabs'], result => {
    const tabsData = result.fasterize_tabs || {};
    const keysToRemove = [];

    // Find all entries for the removed tab
    Object.keys(tabsData).forEach(key => {
      if (key.startsWith(`${tabId}_`)) {
        keysToRemove.push(key);
      }
    });

    // Remove entries for this tab
    keysToRemove.forEach(key => delete tabsData[key]);

    // Save updated tabs data
    browserApi.storage.local.set({ fasterize_tabs: tabsData });
  });
});
