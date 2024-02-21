const browserApi = typeof browser === 'undefined' ? chrome : browser;
function logError(e) {
  console.log(e);
  console.log(browserApi.runtime.lastError, e);
}

function getRootDomain(tmp) {
  let rootDomain = `.${tmp.hostname
    .split('.')
    .slice(-2)
    .join('.')}`;
  if (rootDomain === '.co.uk' || rootDomain === '.com.tr') {
    rootDomain = `.${tmp.hostname
      .split('.')
      .slice(-3)
      .join('.')}`;
  }
  return rootDomain;
}

function setFstrzCookie(url, value) {
  const tmp = document.createElement('a');
  tmp.href = url;

  const rootDomain = getRootDomain(tmp);

  return Promise.all([
    browserApi.cookies.set({
      url: tmp.origin,
      domain: rootDomain,
      name: 'fstrz',
      value,
    }),
    browserApi.cookies.set({
      url: tmp.origin,
      domain: rootDomain,
      name: 'frz-forced-state',
      value: 'true',
    }),
  ]);
}

function setOptimizationCookie(cookieName, url, value) {
  const tmp = document.createElement('a');
  tmp.href = url;

  return browserApi.cookies.set({
    url: tmp.origin,
    domain: getRootDomain(tmp),
    name: cookieName,
    value,
  })
}

function getFstrzCookie(url) {
  const tmp = document.createElement('a');
  tmp.href = url;
  return browserApi.cookies.get({
    url: tmp.origin,
    name: 'fstrz',
  });
}

function getOptimizationCookie(cookieName, url) {
  const tmp = document.createElement('a');
  tmp.href = url;
  return browserApi.cookies.get({
    url: tmp.origin,
    name: cookieName,
  });
}

function getFstrzVaryCookie(url) {
  return browserApi.cookies.get({
    url,
    name: 'fstrz_vary',
  });
}

function getDebugCookie(url) {
  return browserApi.cookies.get({
    url,
    name: 'frz-debug',
  });
}

function setDebugCookie(url, value) {
  const tmp = document.createElement('a');
  tmp.href = url;

  return browserApi.cookies.set({
    url: tmp.origin,
    name: 'frz-debug',
    value,
  });
}

function removeFrzVaryCookie(url) {
  return browserApi.cookies.remove({
    url,
    name: 'fstrz_vary',
  });
}

function reloadPopup(tabID) {
  return browserApi.tabs
    .reload(tabID, { bypassCache: false })
    .then(() => window.close())
    .catch(logError);
}
(() => {
  /* global $ */
  // get the current tab's ID and extract request info
  // from the extension object
  const queryInfo = {
    active: true,
    windowId: browserApi.windows.WINDOW_ID_CURRENT,
  };

  browserApi.tabs.query(queryInfo).then(async tabs => {
    const tabID = tabs[0].id;
    // get the extension's window object
    const details = (await browserApi.storage.local.get([tabID.toString()]))[tabID];
    const request = new FRZRequest(details);
    // throw new Error(`Not implemented ${tabID.toString()} + ${JSON.stringify(request.headers)}`);

    $('#smartcache-toggle').hide();

    if (request.headers['x-fstrz']) {
      const explanation = [];
      for (const flag in request.status) {
        explanation.push(
          `<a class="btn btn-default" data-toggle="tooltip" data-placement="top" title="${
            request.status[flag]
          }">${flag}</a>`
        );
        if (flag === 'sc') {
          $('#smartcache-toggle').show();
        }
      }
      $('#x-fstrz-explanation').html(explanation.join(' '));

      getFstrzCookie(request.details.url)
        .then(fstrzCookie => {
          if ((fstrzCookie && fstrzCookie.value === 'false') || request.headers['x-fstrz'].indexOf('Z') >= 0) {
            $('#fstrz-false').hide();
            $('#optimized_options').hide();
          } else {
            $('#fstrz-true').hide();
          }

          $('#cookie-fstrz').val(fstrzCookie && fstrzCookie.value);
        })
        .catch(logError);

      getOptimizationCookie('frz_espeed', request.details.url)
        .then(optimizationCookie => {
          if (
            (optimizationCookie && optimizationCookie.value === 'false') ||
            request.headers['x-frz-espeed']
          ) {
            $('#fstrz-espeed').prop('checked', false);
          } else {
            $('#fstrz-espeed').prop('checked', true);
          }
        })
        .catch(logError);

      getOptimizationCookie('frz_eseo', request.details.url)
        .then(optimizationCookie => {
          if (
            (optimizationCookie && optimizationCookie.value === 'false') ||
            request.headers['x-frz-eseo']
          ) {
            $('#fstrz-eseo').prop('checked', false);
          } else {
            $('#fstrz-eseo').prop('checked', true);
          }
        })
        .catch(logError);

      getFstrzVaryCookie(request.details.url)
        .then(fstrzVaryCookie => {
          $('#cookie-fstrz-vary').val(fstrzVaryCookie && fstrzVaryCookie.value);
        })
        .catch(logError);

      getDebugCookie(request.details.url)
        .then(debugCookie => {
          if (debugCookie && debugCookie.value === 'true') {
            $('#enable-trace').hide();
          } else {
            $('#disable-trace').hide();
          }
        })
        .catch(logError);

      request
        .getFrzFlags()
        .then(flags => {
          for (flag in flags) {
            document.getElementById(flag).checked = flags[flag];
          }
          $('#testflags table').show();
        })
        .catch(logError);
    } else {
      $('#section-top').text('This website is not served by Fasterize');
      $('#section-middle').hide();
      $('#section-bottom').hide();
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
    $('#statusCode').text(request.headers.status || request.details.statusCode);
    $('#pop').text(request.findPop());
    $('#ip').text(request.ip);

    $('#fstrz-true').on('click', () => {
      setFstrzCookie(request.details.url, 'true')
        .then(() => {
          return reloadPopup(tabID);
        })
        .catch(logError);
    });

    $('#fstrz-false').on('click', () => {
      setFstrzCookie(request.details.url, 'false')
        .then(() => {
          return removeFrzVaryCookie(request.details.url);
        })
        .then(() => {
          return reloadPopup(tabID);
        })
        .catch(logError);
    });

    $('#fstrz-espeed').on('click', () => {
      const checked = $('#fstrz-espeed')
        .prop('checked')
        .toString();
      setOptimizationCookie('frz_espeed', request.details.url, checked)
        .then(() => {
          return reloadPopup(tabID);
        })
        .catch(logError);
    });

    $('#fstrz-eseo').on('click', () => {
      const checked = $('#fstrz-eseo')
        .prop('checked')
        .toString();
      setOptimizationCookie('frz_eseo', request.details.url, checked)
        .then(() => {
          return reloadPopup(tabID);
        })
        .catch(logError);
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

    $('#showLazyloadedImages').on('click', () => {
      request.showLazyloadedImages();
    });

    document.getElementById('feature-flag-table').addEventListener('click', function(e) {
      if (e.target && e.target.nodeName == 'INPUT') {
        toggleFlag(e.target.id);
      }
    });

    function toggleFlag(featureFlagName) {
      const toggle = document.getElementById(featureFlagName).checked,
        flagName = document.getElementById(featureFlagName).dataset.flag;

      const url = new URL(tabs[0].url);
      const params = url.searchParams;
      params.set(flagName, toggle);
      const newUrl = url.toString();

      // chrome doesn't reload the popup by itself, firefox reload the popup
      if (navigator.userAgent.includes('Chrome')) {
        browserApi.tabs.onUpdated.addListener(function(tabID, changeInfo, tab) {
          return reloadPopup(tabID);
        });
      }

      browserApi.tabs.update(tabID, { url: newUrl }).catch(logError);
    }

    $('#getFragments').on('click', () => {
      request.getFragments().then(fragments => {
        fragments &&
          fragments.forEach((fragment, index) => {
            const code = document.createElement('code');
            code.classList.add('html');
            const h3 = document.createElement('h3');
            const pre = document.createElement('pre');
            code.innerText = fragment;
            pre.appendChild(code);

            const re = /data-fstrz-fragment-selector="([^"]*)"/;
            h3.innerText = `${index + 1} - ${re.exec(fragment)[1]}`;
            document.getElementById('fragments_div').appendChild(h3);
            document.getElementById('fragments_div').appendChild(pre);
          });
      });
    });

    browserApi.storage.local
      .get('disable-fasterize-cache')
      .then(res => {
        $('#disable-fasterize-cache').prop('checked', res && res['disable-fasterize-cache']);
      })
      .catch(logError);

    $('#disable-fasterize-cache').change(function() {
      browserApi.storage.local.set({ 'disable-fasterize-cache': this.checked }).catch(logError);
      browserApi.runtime
        .sendMessage({
          action: 'update-settings',
          'disable-fasterize-cache': this.checked,
        })
        .catch(logError);
    });

    $('#show-deferjs-debug').on('click', () => {
      request.getDeferjsDebug();
    });
  });
})();
