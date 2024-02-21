function logError(e) {
  console.log((typeof browser === 'undefined' ? chrome : browser).runtime.lastError, e);
}

// the FRZRequest object, contains information about a request
class FRZRequest {
  constructor(details) {
    this.details = details;
    this.headersRaw = details.responseHeaders;

    // headers will be stored as name: value pairs (all names will be upper case)
    this.headers = {};
    this.optimized = false;
    this.cachedByFasterize = false;
    this.inProgress = false;
    this.inError = false;
    this.cachedbyCDN = false;
    this.headersHints = false;
    this.status = {};
    this.ip = details.ip;

    //define browser api to use
    this.browserApi = typeof browser === 'undefined' ? chrome : browser;

    this.preProcessHeaders();
  }

  // convert the headers array into an object and lowercase all names
  // (warning! will preserve only last of multiple headers with same name)
  preProcessHeaders() {
    this.headersRaw.forEach(function(header) {
      this.headers[header.name.toLowerCase()] = header.value;
    }, this);

    if ('x-fstrz' in this.headers) {
      this.processXFstrzHeader();
    }

    if (this.details.statusCode > 500) {
      this.inError = true;
    }
  }

  processXFstrzHeader() {
    const codeArray = this.headers['x-fstrz'].split(',');

    for (const code of codeArray) {
      if (errorCodes.includes(code)) {
        this.inError = true;
      }

      if (inProgressCodes.includes(code)) {
        this.inProgress = true;
      }

      if (optimizedCodes.includes(code)) {
        this.optimized = true;
      }
      if (cachedCodes.includes(code)) {
        this.cachedByFasterize = true;
      }
      if (headersHints.includes(code)) {
        this.headersHints = true;
      }
    }

    codeArray.forEach(function(code) {
      return (this.status[code] = codeMapping[code]);
    }, this);
  }

  computeExplanation() {
    if (this.servedFromBrowserCache()) {
      return 'The request has been served by the browser cache.';
    } else {
      const protocol = '';
      var status = '';

      if (this.servedByCDN()) {
        status = 'The response has been served by the CDN.';
      } else if (this.servedFromCacheFasterize()) {
        status = 'The response has been served by Fasterize Cache.';
      } else if (this.optimized) {
        status = 'The response has been retrieved on origin servers and optimized on the fly by Fasterize.';
      } else if (this.error) {
        status = 'Error during optimization. See details in debug log.';
      } else if (this.inProgress) {
        status = 'The optimization is in progress but not completed yet.';
      } else if (!this.headers['x-fstrz']) {
        status = 'The page is from the origin because optimizations on HTTPS pages are disabled.';
      } else {
        status = 'The response has been retrieved on origin servers but has not been optimized by Fasterize.';
      }
    }
    return status;
  }

  servedByFasterize() {
    return 'x-fstrz' in this.headers || frzIP.includes(this.details.ip);
  }

  findPop() {
    const ip = this.details.ip;
    if (this.headers['x-amz-cf-pop']) {
      const cfPop = cloudfrontPOP[this.headers['x-amz-cf-pop']];
      if (cfPop) {
        return `CloudFront - ${cfPop['City']}, ${cfPop['Country']}`;
      }
      return `CloudFront`;
    }
    if (this.pluggedToFastly()) {
      return `Fastly - ${this.headers['x-served-by']}`;
    }
    if (this.headers['server'] === 'keycdn-engine') {
      return `KeyCDN - ${keycdnPOP[this.headers['x-edge-location'].replace(/\d+/, '')]}`;
    } else if (this.servedByFasterize()) {
      const pop = frzPoP.find(pop => pop.ip.includes(ip));
      return pop ? pop.popName : frzPoP[0].popName;
    } else {
      return 'Not found';
    }
  }

  servedFromCacheFasterize() {
    return this.cachedByFasterize;
  }

  getProtocol() {
    return this.connectionType;
  }

  servedByCDN() {
    return (
      (this.headers['x-amz-cf-pop'] && this.headers['x-cache'] === 'Hit from cloudfront') ||
      (this.headers['server'] === 'keycdn-engine' && this.headers['x-cache'] === 'HIT') ||
      (this.pluggedToFastly() && this.headers['x-cache'] === 'HIT') ||
      this.headers['x-fstrz-cache'] === 'HIT'
    );
  }

  pluggedToFastly() {
    return (
      this.headers['server'] === 'fasterize' &&
      this.headers['x-served-by'] &&
      this.headers['x-timer'] &&
      this.headers['x-served-by'].startsWith('cache-')
    );
  }

  pluggedToCDN() {
    return (
      this.headers['server'] === 'keycdn-engine' ||
      this.headers['x-fstrz-cache'] !== undefined ||
      this.headers['x-amz-cf-pop'] ||
      this.pluggedToFastly()
    );
  }

  servedFromBrowserCache() {
    // there is no simple way to determine if this.details.fromCache implies that the response has been served from the
    // browser cache or from a service worker
    return false;
  }

  getTabID() {
    return this.details.tabId;
  }

  // figure out what the page action should be based on the
  // features we detected in this request
  getPageActionPath() {
    return this.getImagePath('icons/indicator/');
  }

  getPopupPath() {
    return this.getImagePath('icons/popup/');
  }

  getImagePath(basePath) {
    let filename = 'noFasterize';
    //if served by Fasterize
    const iconPathParts = [];
    if (this.servedFromBrowserCache()) {
      filename = 'cachedByBrowser';
    } else {
      if (this.servedFromCacheFasterize() || this.servedByCDN()) {
        filename = 'cachedByFasterize';
      } else if (this.optimized) {
        filename = 'optimizedByFasterize';
      } else if (this.inError) {
        filename = 'error';
      } else if (this.inProgress) {
        filename = 'inProgress';
      } else if (this.headersHints) {
        filename = 'headersHints';
      } else if (this.servedByFasterize()) {
        filename = 'notOptimized';
      }
    }

    filename += '.png';
    return basePath + filename;
  }

  setPageActionIconAndPopup() {
    const self = this;
    const iconPath = this.getPageActionPath();
    const tabID = this.details.tabId;
    // To handle Chrome and firefox
    console.log('Fasterize active popup');

    if (!this.browserApi.action) {
      console.error('Action API is not available.');
      return;
    }

    if (this.servedByFasterize()) {
      console.log('Fasterize extension : set icon ' + JSON.stringify(this.status));
      this.browserApi.action.setIcon({ tabId: this.details.tabId, path: iconPath }).catch(logError);
      if (self.headers['x-fstrz']) {
        this.browserApi.action.setTitle({ title: `Fasterize Status : ${self.headers['x-fstrz']}`, tabId: tabID }).catch(logError);
      }
      // warning : this part is not called in Chrome
      //  The action.onClicked event won't be sent if the extension action has specified a popup to show on click of the current tab.
      // https://developer.chrome.com/docs/extensions/reference/api/action#popup
      this.browserApi.action.onClicked.addListener(tab => {
        console.log('Fasterize extension : open popup');
        this.browserApi.action.setPopup({ tabId: tabID, popup: 'popup/popup.html' }).catch(logError);

        // OpenPopup is not supported by Chrome
        if (typeof this.browserApi.action.openPopup === 'function') {
          this.browserApi.action.openPopup();
        } else {
          console.log('openPopup() not supported');
        }
      });
    } else {
      this.browserApi.action.setIcon({ tabId: this.details.tabId, path: iconPath }).catch(logError);
    }
  }

  highlightFragments() {
    this.browserApi.tabs.sendMessage(this.details.tabId, { action: 'highlight_fragments' }).catch(logError);
  }

  getFragments() {
    return this.browserApi.tabs.sendMessage(this.details.tabId, { action: 'get_fragments' }).catch(logError);
  }

  getDeferjsDebug() {
    return this.browserApi.tabs.sendMessage(this.details.tabId, { action: 'get_deferjs_debug' }).catch(logError);
  }

  getFrzFlags() {
    return this.browserApi.tabs.sendMessage(this.details.tabId, { action: 'get_frz_flags' }).catch(logError);
  }

  showLazyloadedImages() {
    this.browserApi.tabs.sendMessage(this.details.tabId, { action: 'show_lazyloaded_image' }).catch(logError);
  }
}

// window.FRZRequest = FRZRequest;
