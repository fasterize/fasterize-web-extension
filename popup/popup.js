function setFstrzCookie(url, value, callback) {
  var tmp = document.createElement ('a');
  tmp.href = url;

  chrome.cookies.set({
    url: tmp.origin,
    domain: '.' + tmp.hostname.split('.').slice(-2).join('.'),
    name: 'fstrz',
    value: value
  }, callback);
}

function getFstrzCookie(url, callback) {
  var tmp = document.createElement ('a');
  tmp.href = url;
  chrome.cookies.get({
    url: tmp.origin,
    name: 'fstrz'
  }, callback);
}

function getFstrzVaryCookie(url, callback) {
  chrome.cookies.get({
    url: url,
    name: 'fstrz_vary'
  }, callback);
}

function getDebugCookie(url, callback) {
  chrome.cookies.get({
    url: url,
    name: 'frz-debug'
  }, callback);
}

function setDebugCookie(url, value, callback) {
  var tmp = document.createElement ('a');
  tmp.href = url;

  chrome.cookies.set({
    url: tmp.origin,
    name: 'frz-debug',
    value: value
  }, callback);
}

(function () {
  'use strict';
  /* global $ */
  // get the current tab's ID and extract request info
  // from the extension object
  var queryInfo = {
    active: true,
    windowId: chrome.windows.WINDOW_ID_CURRENT
  };

  chrome.tabs.query(queryInfo, function (tabs) {
    var tabID = tabs[0].id;
    // get the extension's window object
    var extensionWindow = chrome.extension.getBackgroundPage();
    var request = extensionWindow.requests[tabID];

    if (request.headers['x-fstrz']) {
      var explanation = [];
      for(var flag in request.status) {
        explanation.push('<a class="btn btn-default" data-toggle="tooltip" data-placement="top" title="' + request.status[flag] + '">' + flag + '</a>');
      }
      $('#x-fstrz-explanation').html(explanation.join(' '));
    } else {
      $('#x-fstrz-div').hide();
    }

    $('#x-unique-id').val(request.headers['x-unique-id']);
    $('#cache-control').val(request.headers['cache-control']);
    $('#statusExplanation').text(request.computeExplanation());
    $('#protocol').text(request.getProtocol());
    $('#statusCode').text(request.details.statusCode);
    $('#pop').text(request.findPop());

    getFstrzCookie(request.details.url, function (fstrzCookie) {
      if (fstrzCookie && fstrzCookie.value === 'false') {
        $('#fstrz-false').hide();
      }
      else {
        $('#fstrz-true').hide();
      }

      $('#cookie-fstrz').val(fstrzCookie.value);
    });

    getFstrzVaryCookie(request.details.url, function (fstrzVaryCookie) {
      $('#cookie-fstrz-vary').val(fstrzVaryCookie && fstrzVaryCookie.value);
    });

    getDebugCookie(request.details.url, function (debugCookie) {
      if (debugCookie && debugCookie.value === 'false') {
        $('#enable-trace').hide();
      }
      else {
        $('#disable-trace').hide();
      }
    });

    $('#fstrz-true').on('click', function () {
      setFstrzCookie(request.details.url, 'true', function () {
        chrome.tabs.reload(tabID, {bypassCache :false}, chrome.runtime.reload);
      });
    });

    $('#fstrz-false').on('click', function() {
      setFstrzCookie(request.details.url, 'false', function () {
        chrome.tabs.reload(tabID, {bypassCache :false}, chrome.runtime.reload);
      })
    });

    $('#enable-trace').on('click', function () {
      setDebugCookie(request.details.url, 'true', function () {
        chrome.tabs.reload(tabID, {bypassCache :false}, chrome.runtime.reload);
      });
    });

    $('#disable-trace').on('click', function() {
      setDebugCookie(request.details.url, 'false', function () {
        chrome.tabs.reload(tabID, {bypassCache :false}, chrome.runtime.reload);
      })
    });

    $('.copy-button').on('click', function (evt) {
      var $el = $(this);
      var copyId = $el.data('copyId');
      var $copyEl = $('#' + copyId);

      $copyEl.select();
      document.execCommand('copy');

      evt.preventDefault();
    });

    $('[data-toggle="tooltip"]').tooltip();
  });
})();
