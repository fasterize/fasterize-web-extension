function onPageActionClicked (tab) {
  chrome.tabs.create({
    index: tab.index + 1,
    url: 'http://fasterize.com',
    openerTabId: tab.id
  });
}

chrome.extension.onRequest.addListener(function (res, sender) {
  var tab = sender.tab;

  if (res.fasterized) {
    // show page action
    chrome.pageAction.show(tab.id);

    // change icon
    chrome.pageAction.setIcon({
      path: 'icon-fasterize.ico',
      tabId: tab.id
    });

    // change icon tooltip
    chrome.pageAction.setTitle({
      title: tab.url + ' is fasterized',
      tabId: tab.id
    });

    // set click destination
    if (!chrome.pageAction.onClicked.hasListener(onPageActionClicked)) {
      chrome.pageAction.onClicked.addListener(onPageActionClicked);
    }
  }
});
