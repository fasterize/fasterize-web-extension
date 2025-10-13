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
const isPrerenderedRequest = details => {
  return (
    details.documentLifecycle === 'prerender' ||
    details.frameType === 'prerender' ||
    (details.responseHeaders &&
      details.responseHeaders.some(
        header => header.name.toLowerCase() === 'purpose' && header.value.toLowerCase().includes('prerender')
      ))
  );
};

const processCompletedRequest = details => {
  console.log('Fasterize extension : webRequest.onCompleted triggered', details);
  const request = new FRZRequest(details);
  const prerenderKey = `fasterize_prerender_${details.tabId}`;

  if (isPrerenderedRequest(details)) {
    console.log('Fasterize extension : store prerendered navigation', details.url, details);
    browserApi.storage.local.get(prerenderKey, result => {
      if (!result[prerenderKey]) {
        browserApi.storage.local.set({ [prerenderKey]: { [details.url]: details } });

        return;
      }

      result[prerenderKey][details.url] = details;

      browserApi.storage.local.set({ [prerenderKey]: result[prerenderKey] });
    });
  } else {
    browserApi.storage.local.set({ [details.tabId]: details }, () => {
      request.setPageActionIconAndPopup();
    });

    browserApi.storage.local.remove([prerenderKey]);
  }
};
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

/**
 * This event is not relevant anymore since we handle prerendered navigation in tabs.onUpdated
 * Keeping it for old chrom versions that may not support tabs.onUpdated
 */
browserApi.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  console.log('Fasterize extension : tabs.onReplaced', addedTabId, removedTabId);
  browserApi.storage.local.get(removedTabId.toString(), result => {
    if (result[removedTabId]) {
      const request = result[removedTabId];
      browserApi.storage.local.set({ [addedTabId]: request });
      browserApi.storage.local.remove([removedTabId.toString()]);
    } else {
      console.log('Fasterize extension : Could not find an entry in storage when replacing ', removedTabId);
    }
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
  console.log('Fasterize extension : tab closed', tabId);
  browserApi.storage.local.remove([tabId.toString()]);

  const prerenderKey = `fasterize_prerender_${tabId}`;
  browserApi.storage.local.remove([prerenderKey]);
});

const handlePrerenderedNavigation = (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') {
    return;
  }

  return browserApi.storage.local
    .get([tabId.toString(), `fasterize_prerender_${tabId}`])
    .then(result => {
      const prerenderStore = result[`fasterize_prerender_${tabId}`];
      if (!prerenderStore || !prerenderStore[tab.url]) {
        return;
      }

      const currentTabRequest = result[tabId];
      // Only consider the prerendered navigation if it's newer than the current one
      if (!currentTabRequest || currentTabRequest.timeStamp < prerenderStore[tab.url].timeStamp) {
        return browserApi.storage.local
          .set({ [tabId]: prerenderStore[tab.url] })
          .then(() => new FRZRequest(prerenderStore[tab.url]).setPageActionIconAndPopup());
      }
    })
    .catch(e => console.log('Fasterize extension : error handling tab update', e))
    .finally(() => {
      browserApi.storage.local.remove([`fasterize_prerender_${tabId}`]);
    });
};

/**
 * On firefox, the request may have a tabId of -1 in webRequest.onCompleted
 * We refresh to ensure the icon is set when the tab is fully loaded
 */
refreshStatusForFirefox = (tabId, changeInfo) => {
  if (isChrome || changeInfo.status !== 'complete') {
    return;
  }

  return browserApi.storage.local.get(tabId.toString()).then(result => {
    if (result[tabId] && result[tabId].tabId !== -1) {
      console.log('Fasterize extension : refresh status', tabId);
      new FRZRequest(result[tabId]).setPageActionIconAndPopup();
    }
  });
};

browserApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log('Fasterize extension : tab updated', tabId, changeInfo, tab);
  handlePrerenderedNavigation(tabId, changeInfo, tab);

  refreshStatusForFirefox(tabId, changeInfo);
});
