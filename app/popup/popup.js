function logError(e) {
  console.log(browser.runtime.lastError, e);
}

function setFstrzCookie(url, value) {
  const tmp = document.createElement('a');
  tmp.href = url;

  let rootDomain = `.${tmp.hostname.split('.').slice(-2).join('.')}`;
  if (rootDomain === '.co.uk') {
    rootDomain = `.${tmp.hostname.split('.').slice(-3).join('.')}`;
  }

  return Promise.all([
    browser.cookies.set({
      url: tmp.origin,
      domain: rootDomain,
      name: 'fstrz',
      value
    }),
    browser.cookies.set({
      url: tmp.origin,
      domain: rootDomain,
      name: 'frz-forced_state',
      value: 'true'
    })
  ]);
}

function getFstrzCookie(url) {
  const tmp = document.createElement('a');
  tmp.href = url;
  return browser.cookies.get({
    url: tmp.origin,
    name: 'fstrz',
  });
}

function getFstrzVaryCookie(url) {
  return browser.cookies.get({
    url,
    name: 'fstrz_vary',
  });
}

function getDebugCookie(url) {
  return browser.cookies.get({
    url,
    name: 'frz-debug',
  });
}

function setDebugCookie(url, value) {
  const tmp = document.createElement('a');
  tmp.href = url;

  return browser.cookies.set({
    url: tmp.origin,
    name: 'frz-debug',
    value,
  });
}

function removeFrzVaryCookie(url) {
  return browser.cookies.remove({
    url,
    name: 'fstrz_vary',
  });
}

function reloadPopup(tabID) {
  return browser.tabs.reload(tabID, { bypassCache: false }).then(() => window.close()).catch(logError);
}

(() => {
  /* global $ */
  // get the current tab's ID and extract request info
  // from the extension object
  const queryInfo = {
    active: true,
    windowId: browser.windows.WINDOW_ID_CURRENT,
  };

  browser.tabs.query(queryInfo).then(tabs => {
    const tabID = tabs[0].id;
    // get the extension's window object
    const extensionWindow = browser.extension.getBackgroundPage();
    const request = extensionWindow.requests[tabID];

    if (request.headers['x-fstrz']) {
      const explanation = [];
      for (const flag in request.status) {
        explanation.push(
          `<a class="btn btn-default" data-toggle="tooltip" data-placement="top" title="${request.status[
            flag
          ]}">${flag}</a>`
        );
      }
      $('#x-fstrz-explanation').html(explanation.join(' '));
    } else {
      $('#x-fstrz-div').hide();
    }

    if (request.pluggedToCDN()) {
      $('#cdn_status').html(
        request.servedByCDN() ? '<a class="btn btn-default">HIT</a>' : '<a class="btn btn-default">MISS</a>'
      );
    } else {
      $('#cdn_div').hide();
    }

    $('#x-unique-id').val(request.headers['x-unique-id']);
    $('#cache-control').val(request.headers['cache-control']);
    $('#statusExplanation').text(request.computeExplanation());
    $('#protocol').text(request.getProtocol());
    $('#statusCode').text(request.details.statusCode);
    $('#pop').text(request.findPop());
    $('#ip').text(request.ip);

    getFstrzCookie(request.details.url).then(fstrzCookie => {
      if ((fstrzCookie && fstrzCookie.value === 'false') || request.headers['x-fstrz'].indexOf('Z') >= 0) {
        $('#fstrz-false').hide();
      } else {
        $('#fstrz-true').hide();
      }

      $('#cookie-fstrz').val(fstrzCookie && fstrzCookie.value);
    }).catch(logError);

    getFstrzVaryCookie(request.details.url).then(fstrzVaryCookie => {
      $('#cookie-fstrz-vary').val(fstrzVaryCookie && fstrzVaryCookie.value);
    }).catch(logError);

    getDebugCookie(request.details.url).then(debugCookie => {
      if (debugCookie && debugCookie.value === 'true') {
        $('#enable-trace').hide();
      } else {
        $('#disable-trace').hide();
      }
    }).catch(logError);

    $('#fstrz-true').on('click', () => {
      setFstrzCookie(request.details.url, 'true').then(() => {
        return reloadPopup(tabID);
      }).catch(logError);
    });

    $('#fstrz-false').on('click', () => {
      setFstrzCookie(request.details.url, 'false')
        .then(() => {
          return removeFrzVaryCookie(request.details.url);
        })
        .then(() => {
          return reloadPopup(tabID);
        }).catch(logError);
    });

    $('#enable-trace').on('click', () => {
      setDebugCookie(request.details.url, 'true').then(() => {
        return reloadPopup(tabID);
      });
    });

    $('#disable-trace').on('click', () => {
      setDebugCookie(request.details.url, 'false').then(() => {
        return reloadPopup(tabID);
      });
    });

    $('.copy-button').on('click', function(evt) {
      const $el = $(this);
      const copyId = $el.data('copyId');
      const $copyEl = $(`#${copyId}`);

      $copyEl.select();
      document.execCommand('copy');

      evt.preventDefault();
    });

    $('[data-toggle="tooltip"]').tooltip();

    $('#highlightFragments').on('click', () => {
      request.highlightFragments();
    });

    $('#getFragments').on('click', () => {
      request.getFragments().then(fragments => {
        fragments.forEach((fragment, index) => {
          const code = document.createElement('code');
          code.classList.add('html');
          const h3 = document.createElement('h3');
          const pre = document.createElement('pre');
          code.innerText = fragment;
          pre.appendChild(code);

          h3.innerText = `#${index + 1}`;
          document.getElementById('fragments_div').appendChild(h3);
          document.getElementById('fragments_div').appendChild(pre);
        });
      });
    });

    browser.storage.local.get('disable-fasterize-cache').then(res => {
      $('#disable-fasterize-cache').prop('checked', res && res['disable-fasterize-cache']);
    }).catch(logError);

    $('#disable-fasterize-cache').change(function() {
      browser.storage.local.set({ 'disable-fasterize-cache': this.checked }).catch(logError);
      browser.runtime.sendMessage({ action: 'update-settings', 'disable-fasterize-cache': this.checked }).catch(logError);
    });
  });
})();
