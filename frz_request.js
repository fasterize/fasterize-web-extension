// the FRZRequest object, contains information about a request
var FRZRequest = function (details) {
  this.details = details;
  this.headersRaw = details.responseHeaders;

  // headers will be stored as name: value pairs (all names will be upper case)
  this.headers = {};

  // weather the request object knows about the SPDY status or not
  // this status is available in the context of the page, requires message passing
  // from the extension to the page
  this.hasConnectionInfo = false;
  this.SPDY = false;
  this.connectionType = null;
  this.optimized = false;
  this.cachedByFasterize = false;
  this.cachedbyCDN = false;

  this.preProcessHeaders();
};

// convert the headers array into an object and upcase all names
// (warning! will preserve only last of multiple headers with same name)
FRZRequest.prototype.preProcessHeaders = function () {
  this.headersRaw.forEach(function (header) {
    this.headers[header.name.toLowerCase()] = header.value;
  }, this);

  console.log(this.headers);
  if ('x-fstrz' in this.headers) {
    this.processXFstrzHeader();
  }
};

FRZRequest.prototype.processXFstrzHeader = function () {
  console.log("processXFstrzHeader");
  var fstrzHeader = this.headers['x-fstrz'];

  var codeArray = fstrzHeader.split(',');
  for (var j = 0; j < codeArray.length; j++) {
    var code = codeArray[j];
    if (optimizedCodes.indexOf(code) !== -1) {
      console.log("optimized");
      this.optimized = true;
    }
    if (cachedCodes.indexOf(code) !== -1) {
      console.log("cachedbyFasterize");
      this.cachedByFasterize = true;
    }
  }
  this.xfstrzHeader = fstrzHeader;

  this.status = codeArray.map(function(code) {
    return codeMapping[code];
  }).join("\n-");
};

FRZRequest.prototype.queryConnectionInfoAndSetIcon = function () {
  var tabID = this.details.tabId;
  if (this.servedFromBrowserCache() || this.hasConnectionInfo) {
    this.setPageActionIconAndPopup();
  } else {
    var csMessageData = {
      action: 'check_connection_info'
    };
    var csMessageCallback = function (csMsgResponse) {
      // stop and return if we don't get a response, happens with hidden/background tabs
      if (typeof csMsgResponse === 'undefined') {
        return;
      }

      var request = window.requests[tabID];
      request.setConnectionInfo(csMsgResponse);
      request.setPageActionIconAndPopup();
    };

    try {
      chrome.tabs.sendMessage(this.details.tabId, csMessageData, csMessageCallback);
    } catch (e) {
      console.log('caught exception when sending message to content script');
      console.log(chrome.extension.lastError());
      console.log(e);
    }
  }
};

FRZRequest.prototype.servedByFasterize = function () {
  return ('X-fstrz' in this.headers || 'x-fstrz' in this.headers);
};

FRZRequest.prototype.servedFromCacheFasterize = function () {
  return this.cachedByFasterize;
};

FRZRequest.prototype.optimizedByFasterize = function () {
  return this.optimized;
};

FRZRequest.prototype.servedOverSPDY = function () {
  return this.SPDY && this.connectionType.match(/^spdy/);
};

FRZRequest.prototype.servedOverH2 = function () {
  return this.SPDY && this.connectionType === 'h2';
};

FRZRequest.prototype.servedFromCDN = function () {
  return false;
}

FRZRequest.prototype.servedFromBrowserCache = function () {
  return this.details.fromCache;
};

FRZRequest.prototype.getTabID = function () {
  return this.details.tabId;
};

// figure out what the page action should be based on the
// features we detected in this request
FRZRequest.prototype.getPageActionPath = function () {
  return this.getImagePath('icons/indicator/');
};

FRZRequest.prototype.getPopupPath = function () {
  return this.getImagePath('icons/popup/');
};

FRZRequest.prototype.getImagePath = function (basePath) {
  //if served by Fasterize
  var iconPathParts = [];

  if (!this.servedByFasterize()) {
    iconPathParts.push('off');
  } else {
    iconPathParts.push('on');

    if (this.servedFromBrowserCache()) {
      iconPathParts.push('cachedByBrowser');
    }
    else {
      if (this.servedOverSPDY()) {
        iconPathParts.push('spdy');
      } else if (this.servedOverH2()) {
        iconPathParts.push('http2');
      } else {
        iconPathParts.push('http1');
      }

      if (this.servedFromCacheFasterize()) {
        iconPathParts.push('cachedByFasterize');
      } else if (this.optimizedByFasterize()) {
        iconPathParts.push('optimizedByFasterize');
      } else {
        iconPathParts.push('notOptimized');
      }
    }
  }

  console.log(this.xfstrzHeader, basePath + iconPathParts.join('-') + '.png');
  return basePath + iconPathParts.join('-') + '.png';
};

FRZRequest.prototype.setConnectionInfo = function (connectionInfo) {
  this.hasConnectionInfo = true;
  this.SPDY = connectionInfo.spdy;
  this.connectionType = connectionInfo.type;
};

FRZRequest.prototype.setPageActionIconAndPopup = function () {
  console.log('setPageActionIconAndPopup');
  var iconPath = this.getPageActionPath();
  var tabID = this.details.tabId;
  var self = this;
  chrome.pageAction.setIcon({
    tabId: this.details.tabId,
    path: iconPath
  }, function () {
    try {
      chrome.pageAction.setPopup({
        tabId: tabID,
        popup: 'popup.html'
      });

      chrome.pageAction.setTitle({
        "title": "Fasterize Status : " + self.xfstrzHeader,
        "tabId": tabID
      });

      chrome.pageAction.show(tabID);
    } catch (e) {
      console.log('Exception on page action show for tab with ID: ', tabID, e);
    }
  });
};

window.FRZRequest = FRZRequest;
