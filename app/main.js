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

  // TODO refactor in a function
  const isPrerender =
    details.documentLifecycle === 'prerender' ||
    details.frameType === 'prerender' ||
    (details.responseHeaders &&
      details.responseHeaders.some(
        header => header.name.toLowerCase() === 'purpose' && header.value.toLowerCase().includes('prerender')
      ));

  console.log('Fasterize extension : isPrerender = ', isPrerender, details);

  const prerenderKey = `fasterize_prerender_${details.tabId}`;
  if (isPrerender) {
    // TODO refactor in a function
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

browserApi.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  // TODO remove log
  console.log('Fasterize extension : tab replaced', addedTabId, removedTabId);
  // TODO : Keep legacy behavior ? For page instanct or other cases ?
  // Move normal navigation data
  browserApi.storage.local.get(removedTabId.toString(), result => {
    if (result[removedTabId]) {
      const request = result[removedTabId];
      browserApi.storage.local.set({ [addedTabId]: request });
      browserApi.storage.local.remove([removedTabId.toString()]);
    } else {
      console.log('Fasterize extension : Could not find an entry in storage when replacing ', removedTabId);
    }
  });

  const oldPrerenderKey = `fasterize_prerender_${removedTabId}`;

  console.log('Fasterize extension : Check prerender data for ', oldPrerenderKey);
  browserApi.storage.local.get([oldPrerenderKey], result => {
    if (result[oldPrerenderKey]) {
      // TODO must contains a dictionnary with url as key because there may be several prerender
      const prerenderData = result[oldPrerenderKey];
      // Move to tabId key because the navigation is done
      browserApi.storage.local.set({ [addedTabId]: prerenderData });
      browserApi.storage.local.remove([oldPrerenderKey]);
      console.log(
        'Fasterize extension : Prerender data has been set with values ',
        prerenderData,
        ' on tabId ',
        addedTabId
      );

      // If the navigation is prerender, create FRZRequest and set icon
      const request = new FRZRequest(prerenderData);
      request.setPageActionIconAndPopup();
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

// TODO refactor in functions
browserApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log('Fasterize extension : tab updated', tabId, changeInfo, tab);
  if (changeInfo.status === 'complete') {
    // TODO rewrite use then
    browserApi.storage.local.get([tabId.toString(), `fasterize_prerender_${tabId}`], result => {
      const prerenderStore = result[`fasterize_prerender_${tabId}`];
      if (prerenderStore && prerenderStore[tab.url]) {
        console.log(
          'Fasterize extension : Found prerender data for this tab',
          tabId,
          tab.url,
          prerenderStore,
          result[tabId],
          result[tabId]?.timeStamp,
          prerenderStore[tab.url]?.timeStamp,
          result[tabId]?.timeStamp < prerenderStore[tab.url]?.timeStamp,
          !result[tabId] || result[tabId]?.timeStamp < prerenderStore[tab.url].timeStamp
        );
        if (!result[tabId] || result[tabId].timeStamp < prerenderStore[tab.url].timeStamp) {
          console.log('Fasterize extension : Use prerender data for this tab', tabId, tab.url, prerenderStore);
          browserApi.storage.local.set({ [tabId]: prerenderStore[tab.url] }, () => {
            console.log('Fasterize extension : Set prerender data for this tab', tabId, tab.url, prerenderStore);
            new FRZRequest(prerenderStore[tab.url]).setPageActionIconAndPopup();
          });
        }
      }
      browserApi.storage.local.remove([`fasterize_prerender_${tabId}`]);
    });
  }
});
