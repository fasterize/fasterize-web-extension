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
  this.inProgress = false;
  this.inError = false;
  this.cachedbyCDN = false;
  this.status = {};

  this.preProcessHeaders();
};

// convert the headers array into an object and upcase all names
// (warning! will preserve only last of multiple headers with same name)
FRZRequest.prototype.preProcessHeaders = function () {
  this.headersRaw.forEach(function (header) {
    this.headers[header.name.toLowerCase()] = header.value;
  }, this);

  if ('x-fstrz' in this.headers) {
    this.processXFstrzHeader();
  }

  if (this.details.statusCode > 500) {
    this.inError = true;
  }
};

FRZRequest.prototype.processXFstrzHeader = function () {
  var codeArray = this.headers['x-fstrz'].split(',');
  for (var j = 0; j < codeArray.length; j++) {
    var code = codeArray[j];
    if (errorCodes.indexOf(code) !== -1) {
      this.inError = true;
    }

    if (inProgressCodes.indexOf(code) !== -1) {
      this.inProgress = true;
    }

    if (optimizedCodes.indexOf(code) !== -1) {
      this.optimized = true;
    }
    if (cachedCodes.indexOf(code) !== -1) {
      this.cachedByFasterize = true;
    }
  }

  codeArray.forEach(function(code) {
    return this.status[code] = codeMapping[code];
  }, this);
};

FRZRequest.prototype.computeExplanation = function () {
  if (this.servedFromBrowserCache()) {
    return "The request has been served by the browser cache.";
  }
  else {
    var protocol = "", status = "";

    if (this.servedFromCacheFasterize()) {
      status = "The response has been served by Fasterize Cache.";
    } else if (this.optimized) {
      status = "The response has been retrieved on the origin servers and optimized on the fly by Fasterize.";
    } else if (this.error) {
      status = "The optimization is in error. The error is detailled in the debug log";
    } else if (this.inProgress) {
      status = "The optimization is in progress but not completed.";
    } else {
      status = "The response has been retrieved on the origin servers but has not been optimized by Fasterize.";
    }
  }
  return status;
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
  return ('x-fstrz' in this.headers ||
    this.details.ip === "212.83.128.22" ||
    this.details.ip === "212.83.173.208" ||
    this.details.ip === "122.144.138.114" ||
    this.details.ip === "122.144.138.113" ||
    this.details.ip === "162.243.74.238" ||
    this.details.ip === "104.236.170.152");
};

FRZRequest.prototype.findPop = function () {
  if (this.details.ip === "212.83.128.22" || this.details.ip === "212.83.173.208") {
    return "Paris (France)"
  }
  else if (this.details.ip === "122.144.138.114" || this.details.ip === "122.144.138.113") {
    return "Shanghai (China)";
  }
  else if (this.details.ip === "162.243.74.238") {
    return "New York (United States)";
  }
  else if (this.details.ip === "104.236.170.152") {
    return "San Francisco (United States)";
  }
};

FRZRequest.prototype.servedFromCacheFasterize = function () {
  return this.cachedByFasterize;
};


FRZRequest.prototype.getProtocol = function () {
  if (this.SPDY && this.connectionType.match(/^spdy/)) {
    return "SPDY/3.1";
  }
  else if (this.SPDY && this.connectionType === 'h2') {
    return "HTTP/2";
  }
  else {
    return "HTTP/1.1";
  }
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
  var filename = '';
  //if served by Fasterize
  var iconPathParts = [];
  if (this.servedFromBrowserCache()) {
    filename = 'cachedByBrowser.png';
  }
  else {
    if (this.servedFromCacheFasterize()) {
      filename = 'cachedByFasterize.png';
    } else if (this.optimized) {
      filename = 'optimizedByFasterize.png';
    } else if (this.inError) {
      filename = 'error.png';
    } else if (this.inProgress) {
      filename = 'inProgress.png';
    } else {
      filename = 'notOptimized.png';
    }
  }

  return basePath + filename;
};

FRZRequest.prototype.setConnectionInfo = function (connectionInfo) {
  this.hasConnectionInfo = true;
  this.SPDY = connectionInfo.spdy;
  this.connectionType = connectionInfo.type;
};

FRZRequest.prototype.setPageActionIconAndPopup = function () {
  if (this.servedByFasterize()) {
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
          popup: 'popup/popup.html'
        });

        if (self.headers['x-fstrz']) {
          chrome.pageAction.setTitle({
            "title": "Fasterize Status : " + self.headers['x-fstrz'],
            "tabId": tabID
          });
        }

        chrome.pageAction.show(tabID);
      } catch (e) {
        console.log('Exception on page action show for tab with ID: ', tabID, e);
      }
    });
  }
};

window.FRZRequest = FRZRequest;
