var findHeaderListener;
var selectedId = null;
var tabFasterized = {};
var tabFasterizedHeader = {};
var notOptimizedCode = ["b", "!o", "Z", "ab", "ecc", "eec", "m", "h", "e", "t", "cbo"];

var codeMapping = {
  "p" : "proxified",
  "o" : "optimized",
  "b" : "ip blocked",
  "!o": "not optimized",
  "w": "working",
  "r": "apply configuration",
  "Z": "not optimizable",
  "ab": "not optimized (abtest)",
  "sc": "status code different than 200",
  "zc": "no content",
  "ecc": "excluded by the configuration",
  "eec": "excluded by the engine",
  "tecc": "tag excluded by the configuration",
  "m": "method not optimizable",
  "ed": "engine disabled",
  "h": "not html content",
  "c": "cached",
  "dc": "dynamic cached",
  "!c": "not cachable",
  "v": "virtual resource",
  "e": "error in the engine",
  "vf": "virtual fallback",
  "t": "timeout",
  "ccb": "cache callback",
  "cbo": "circuit breaker opened"
}

findHeaderListener = function(details) {
  var fasterized = null;
  for (var i = 0; i < details.responseHeaders.length; i++) {
    var header = details.responseHeaders[i];
    if (header.name == 'x-fstrz') {
      var codeArray = header.value.split(',');
      for (var j = 0; j < codeArray.length; j++) {
        var code = codeArray[j];
        if (notOptimizedCode.indexOf(code) !== -1) {
          fasterized = "unoptimized";
          break;
        }
      }
	    if (fasterized === null) {
        fasterized = "optimized";
	    }
      tabFasterizedHeader[details.tabId] = header.value;
	    break;
	  }
  }
	tabFasterized[details.tabId] = fasterized;

  chrome.webRequest.onHeadersReceived.removeListener(findHeaderListener);
	updatePageAction(details.tabId);
}

chrome.webNavigation.onBeforeNavigate.addListener(function(details) {
  if (details.frameId == 0) {
	var filter = {types:["main_frame"], urls:["<all_urls>"]};
    chrome.webRequest.onResponseStarted.addListener(findHeaderListener, filter,["responseHeaders"]);
  }
});



function translateStatusCode(fstrzHeader) {
  var fstrzHeaderArray = fstrzHeader.split(',');
  reasonsArray = fstrzHeaderArray.map(function(code) {
    return codeMapping[code];
  });
  return reasonsArray.join("\n-");
}


function updatePageAction(tabId) {
  if (tabFasterized[tabId]) {
    chrome.pageAction.setIcon({
      tabId: tabId,
	    path: tabFasterized[tabId] + "19.png"
    }, function() {
	  chrome.pageAction.setTitle({
	    "title": "Fasterize Status : " + tabFasterizedHeader[tabId] + " \n-" + translateStatusCode(tabFasterizedHeader[tabId]),
		  "tabId": tabId
	  });
      chrome.pageAction.show(tabId);
    });
  }
  else {
    chrome.pageAction.hide(tabId);
  }
}

chrome.tabs.onSelectionChanged.addListener(function(tabId, info) {
  selectedId = tabId;
});

chrome.tabs.onUpdated.addListener(function(tabId, change, tab) {
   updatePageAction(tabId);
});

chrome.tabs.getSelected(null, function(tab) {
  updatePageAction(tab.id);
});
