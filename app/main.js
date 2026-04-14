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
    if (dashboardPort) {
      dashboardPort.postMessage({ type: 'FSTRZ_SELECTOR_RESULT', success: false });
    }
    cleanupPickerSession(true); // skip window removal, tab is already gone
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
// Communication via long-lived ports (keeps SW alive during picking):
//   dashboard → onConnectExternal (port 'fstrz-picker-dashboard') → open window → inject picker-content.js
//   picker-content.js → onConnect (port 'fstrz-picker') → relay result → dashboardPort

let activePickerSession = null;
let dashboardPort = null;

// Recover from SW restart: clean up orphaned picker sessions
browserApi.storage.session.get('pickerSession').then(result => {
  if (result.pickerSession) {
    console.log('Fasterize extension : cleaning up orphaned picker session');
    var session = result.pickerSession;
    removePickerJsBlockingRules();
    browserApi.windows.remove(session.pickerWindowId).catch(() => {});
    browserApi.storage.session.remove('pickerSession');
  }
}).catch(() => {});

// External messages from the dashboard (via externally_connectable) — one-shot only
browserApi.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'FSTRZ_PING') {
    sendResponse({ type: 'FSTRZ_PONG' });
    return false;
  }

  return false;
});

// External port connections from the dashboard
browserApi.runtime.onConnectExternal.addListener(port => {
  if (port.name !== 'fstrz-picker-dashboard') return;

  dashboardPort = port;

  port.onMessage.addListener(message => {
    if (message.type === 'FSTRZ_OPEN_PICKER') {
      handleOpenPicker(message, port.sender && port.sender.tab ? port.sender.tab.id : undefined);
    }
  });

  port.onDisconnect.addListener(() => {
    // Dashboard closed during picking — cleanup
    if (dashboardPort === port) {
      dashboardPort = null;
      if (activePickerSession) {
        cleanupPickerSession();
      }
    }
  });
});

// Internal port connections from picker-content.js
browserApi.runtime.onConnect.addListener(port => {
  if (port.name !== 'fstrz-picker') return;
  if (!activePickerSession) return;
  if (!port.sender || !port.sender.tab || port.sender.tab.id !== activePickerSession.pickerTabId) return;

  activePickerSession.pickerPort = port;

  port.onMessage.addListener(message => {
    if (message.type === 'FSTRZ_SELECTOR_PICKED') {
      if (dashboardPort) {
        dashboardPort.postMessage({
          type: 'FSTRZ_SELECTOR_RESULT',
          success: true,
          selector: message.selector,
          previewText: message.previewText,
          matchCount: message.matchCount,
        });
      }
      cleanupPickerSession();
    } else if (message.type === 'FSTRZ_PICK_CANCELLED') {
      if (dashboardPort) {
        dashboardPort.postMessage({ type: 'FSTRZ_SELECTOR_RESULT', success: false });
      }
      cleanupPickerSession();
    }
  });

  port.onDisconnect.addListener(() => {
    if (activePickerSession && activePickerSession.pickerPort === port) {
      if (dashboardPort) {
        dashboardPort.postMessage({ type: 'FSTRZ_SELECTOR_RESULT', success: false });
      }
      cleanupPickerSession();
    }
  });
});

// Re-inject picker if user navigates within the picker tab
browserApi.webNavigation.onCompleted.addListener(details => {
  if (!activePickerSession || details.tabId !== activePickerSession.pickerTabId) return;
  if (details.frameId !== 0) return; // Main frame only
  injectPicker(details.tabId);
});

// IDs for declarativeNetRequest session rules (picker JS blocking)
var PICKER_BLOCK_SCRIPTS_RULE_ID = 9001;
var PICKER_BLOCK_INLINE_SCRIPTS_RULE_ID = 9002;

async function addPickerJsBlockingRules(tabId) {
  await browserApi.declarativeNetRequest.updateSessionRules({
    addRules: [
      {
        id: PICKER_BLOCK_SCRIPTS_RULE_ID,
        condition: { resourceTypes: ['script'], tabIds: [tabId] },
        action: { type: 'block' },
      },
      {
        id: PICKER_BLOCK_INLINE_SCRIPTS_RULE_ID,
        condition: { resourceTypes: ['main_frame', 'sub_frame'], tabIds: [tabId] },
        action: {
          type: 'modifyHeaders',
          responseHeaders: [
            { header: 'Content-Security-Policy', operation: 'set', value: "script-src 'none'" },
          ],
        },
      },
    ],
  });
}

async function removePickerJsBlockingRules() {
  try {
    await browserApi.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [PICKER_BLOCK_SCRIPTS_RULE_ID, PICKER_BLOCK_INLINE_SCRIPTS_RULE_ID],
    });
  } catch (e) { /* rules may already be removed */ }
}

async function handleOpenPicker(message, dashboardTabId) {
  // Validate URL
  let parsed;
  try {
    parsed = new URL(message.url);
  } catch (e) {
    parsed = null;
  }
  if (!parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) {
    if (dashboardPort) {
      dashboardPort.postMessage({ type: 'FSTRZ_SELECTOR_RESULT', success: false });
    }
    return;
  }

  // Cancel existing session
  if (activePickerSession) {
    if (dashboardPort) {
      dashboardPort.postMessage({ type: 'FSTRZ_SELECTOR_RESULT', success: false });
    }
    await cleanupPickerSession();
  }

  // Create new window without URL (about:blank), block JS, then navigate
  try {
    const win = await browserApi.windows.create({
      type: 'normal',
      focused: true,
    });

    const tabId = win.tabs && win.tabs[0] ? win.tabs[0].id : undefined;
    if (!tabId || !win.id) {
      if (dashboardPort) {
        dashboardPort.postMessage({ type: 'FSTRZ_SELECTOR_RESULT', success: false });
      }
      return;
    }

    // Block all JS execution on this tab before navigating
    await addPickerJsBlockingRules(tabId);

    // Now navigate to the target URL (JS is already blocked)
    await browserApi.tabs.update(tabId, { url: message.url });

    activePickerSession = {
      dashboardTabId: dashboardTabId,
      pickerTabId: tabId,
      pickerWindowId: win.id,
      pickerPort: null,
    };

    // Persist session for SW recovery
    browserApi.storage.session.set({
      pickerSession: {
        dashboardTabId: dashboardTabId,
        pickerTabId: tabId,
        pickerWindowId: win.id,
      },
    });

    injectPicker(tabId);
  } catch (e) {
    console.log('Fasterize extension : failed to open picker window', e);
    await removePickerJsBlockingRules();
    if (dashboardPort) {
      dashboardPort.postMessage({ type: 'FSTRZ_SELECTOR_RESULT', success: false });
    }
  }
}

async function cleanupPickerSession(skipWindowRemoval) {
  if (!activePickerSession) return;
  var session = activePickerSession;
  activePickerSession = null;

  await removePickerJsBlockingRules();
  browserApi.storage.session.remove('pickerSession');

  if (session.pickerPort) {
    try { session.pickerPort.disconnect(); } catch (e) { /* already disconnected */ }
  }

  if (!skipWindowRemoval) {
    try {
      await browserApi.windows.remove(session.pickerWindowId);
    } catch (e) { /* window may already be closed */ }
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
