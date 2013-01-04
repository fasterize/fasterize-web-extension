window.onload = function () {
  var submit = document.getElementById('submit');

  function init() {
    getCurrentTab(function (tab) {
      var urlParams = decodeParams(tab.url);
      var checkbox;
      for( var p in urlParams) {
        if (p.indexOf("frz") !== -1) {
          checkbox = document.getElementById(p);
          checkbox.setAttribute("checked", "checked");
        }
      }
    });
  }

  init();

  function changeTab(e) {
    e.preventDefault();
    getCurrentTab(function (tab) {
      var
        elements,
        urlParams,
        baseUrl;

      elements = document.querySelectorAll(":checked");
      elements = Array.prototype.slice.call(elements);
      urlParams = decodeParams(tab.url);
      urlParams = removeAllFrzParams(urlParams);

      elements.forEach(function (element) {
        urlParams[element.value] = false;
      });

      urlParams = encodeParams(urlParams);
      baseUrl = getBaseUrl(tab.url);
      if (urlParams.length > 0) {
        urlParams = "?" + urlParams;
      }

      chrome.tabs.update(tab.id, {url: baseUrl + urlParams});
    });
  }

  submit.onclick = changeTab;
};

function getCurrentTab(cb) {
  chrome.tabs.query({
      "active": true,
      "currentWindow": true
    }, function (tabs) {
      cb(tabs[0]);
  });
}

function removeAllFrzParams(params) {
  for (var p in params) {
    if (p.indexOf("frz-") !== -1) {
      delete params[p];
    }
  }
  return params;
}

function getBaseUrl(url) {
  if (url.indexOf('?') === -1) {
    return url;
  }
  else {
    return url.substring(0, url.indexOf('?'));
  }
}

function decodeParams(url) {
  var request = {};
  if (url.indexOf('?') === -1) {
    return request;
  }

  var pairs = url.substring(url.indexOf('?') + 1).split('&');
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].split('=');
    request[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
  }
  return request;
}

function encodeParams(array) {
  var pairs = [];
  for (var key in array)
    if (array.hasOwnProperty(key))
      pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(array[key]));
  return pairs.join('&');
}
