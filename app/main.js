// Check chrome
try {
  importScripts('mapping.js', 'frz-request.js');
} catch (e) {
  console.log(e);
}

const isChrome = typeof browser === 'undefined';
const browserApi = isChrome ? chrome : browser;
if (!isChrome) {
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

  // Picker: cleanup session if picker tab was closed
  if (activePickerSession && activePickerSession.pickerTabId === tabId) {
    activePickerSession.sendResponse({ success: false });
    activePickerSession = null;
  }
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

// ─── CSS Selector Picker ────────────────────────────────────────────────────
// Allows the dashboard to open a visual element picker on any page.
// Communication: dashboard → onMessageExternal → open window → inject picker-content.js
//                picker-content.js → onMessage → relay result back to dashboard

let activePickerSession = null;

// External messages from the dashboard (via externally_connectable)
browserApi.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'FSTRZ_PING') {
    sendResponse({ type: 'FSTRZ_PONG' });
    return false;
  }

  if (message.type === 'FSTRZ_OPEN_PICKER') {
    handleOpenPicker(message, sender.tab ? sender.tab.id : undefined, sendResponse);
    return true; // Keep channel open for async response
  }

  return false;
});

// Internal messages from picker-content.js (selector picked or cancelled)
// Uses message.type (not message.action) so no conflict with existing handler
browserApi.runtime.onMessage.addListener((message, sender) => {
  if (!activePickerSession) return;

  if (message.type === 'FSTRZ_SELECTOR_PICKED' && sender.tab && sender.tab.id === activePickerSession.pickerTabId) {
    activePickerSession.sendResponse({
      success: true,
      selector: message.selector,
      previewText: message.previewText,
      matchCount: message.matchCount,
    });
    browserApi.windows.remove(activePickerSession.pickerWindowId).catch(() => {});
    activePickerSession = null;
  } else if (message.type === 'FSTRZ_PICK_CANCELLED' && sender.tab && sender.tab.id === activePickerSession.pickerTabId) {
    activePickerSession.sendResponse({ success: false });
    browserApi.windows.remove(activePickerSession.pickerWindowId).catch(() => {});
    activePickerSession = null;
  }
});

// Re-inject picker if user navigates within the picker tab
browserApi.webNavigation.onCompleted.addListener(details => {
  if (!activePickerSession || details.tabId !== activePickerSession.pickerTabId) return;
  if (details.frameId !== 0) return; // Main frame only
  injectPicker(details.tabId);
});

async function handleOpenPicker(message, dashboardTabId, sendResponse) {
  // Validate URL
  let parsed;
  try {
    parsed = new URL(message.url);
  } catch (e) {
    parsed = null;
  }
  if (!parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) {
    sendResponse({ success: false });
    return;
  }

  // Cancel existing session
  if (activePickerSession) {
    try {
      await browserApi.windows.remove(activePickerSession.pickerWindowId);
    } catch (e) { /* window may already be closed */ }
    activePickerSession.sendResponse({ success: false });
    activePickerSession = null;
  }

  // Create new window with target URL
  try {
    const win = await browserApi.windows.create({
      url: message.url,
      type: 'normal',
      focused: true,
    });

    const tabId = win.tabs && win.tabs[0] ? win.tabs[0].id : undefined;
    if (!tabId || !win.id) {
      sendResponse({ success: false });
      return;
    }

    activePickerSession = {
      dashboardTabId: dashboardTabId,
      pickerTabId: tabId,
      pickerWindowId: win.id,
      sendResponse: sendResponse,
    };
  } catch (e) {
    console.log('Fasterize extension : failed to open picker window', e);
    sendResponse({ success: false });
  }
}

async function injectPicker(tabId) {
  try {
    await browserApi.scripting.executeScript({
      target: { tabId: tabId },
      files: ['picker-content.js'],
    });
    await browserApi.tabs.sendMessage(tabId, { type: 'FSTRZ_ACTIVATE_PICKER' });
  } catch (e) {
    console.log('Fasterize extension : failed to inject picker', e);
  }
}
