/* those methods are executed in the context of the current tab */

/**
 * See getRootDomain from popup.js
 */
function getRootDomainFromHostname(hostname) {
  const parts = hostname.split('.');
  let rootDomain = `.${parts.slice(-2).join('.')}`;
  if (rootDomain === '.co.uk' || rootDomain === '.com.tr') {
    rootDomain = `.${parts.slice(-3).join('.')}`;
  }
  return rootDomain;
}

function parseCookieValue(name) {
  const match = document.cookie.split('; ').find(c => c.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : null;
}

function setDocumentCookie(name, value, domain) {
  document.cookie = `${name}=${value}; path=/; domain=${domain}; max-age=31536000`;
}

function removeDocumentCookie(name, domain) {
  document.cookie = `${name}=; path=/; domain=${domain}; max-age=0`;
}

function highlightFragments() {
  const fragments = document.querySelectorAll('[data-fstrz-fragment-id]');
  fragments.forEach(f => {
    f.style.border = '3px solid #fa9730';
  });
}

function getFragments() {
  const fragments = document.querySelectorAll('[data-fstrz-fragment-id]');
  const res = Array.prototype.slice.call(fragments).map(fragment => fragment.outerHTML);
  return res;
}

function getFstrzDebugScript() {
  var s = document.createElement('script');
  var runtimeApi = typeof browser === 'undefined' ? chrome.runtime : browser.runtime;
  s.setAttribute('type', 'text/javascript');
  s.setAttribute('src', runtimeApi.getURL('show_fstrz_traces.js'));
  document.body.appendChild(s);
}

function addOverlayOnLazyloadedImages() {
  var node = document.createElement('style');
  node.innerHTML = 'img[data-lzled], img.lazyloaded { border: 3px solid #ff0090; box-sizing: border-box;}';
  document.body.appendChild(node);
}

function getFrzFlags() {
  return document.body.dataset.frzFlags && JSON.parse(document.body.dataset.frzFlags);
}

function getTargetLabel() {
  return document.body.dataset.frzTargetLabel;
}

function getPageType() {
  const beaconScript = document.getElementById('frz-beacon-script');

  return beaconScript ? beaconScript.getAttribute('data-page-type') || '' : 'Missing beacon script';
}

browser.runtime.onMessage.addListener((request, sender) => {
  switch (request.action) {
    case 'get_cookie': {
      const value = parseCookieValue(request.name);
      return Promise.resolve(value !== null ? { value } : null);
    }
    case 'set_fstrz_cookie': {
      const domain = getRootDomainFromHostname(window.location.hostname);
      setDocumentCookie('fstrz', request.value, domain);
      setDocumentCookie('frz-forced-state', 'true', domain);
      return Promise.resolve();
    }
    case 'set_cookie': {
      const domain = getRootDomainFromHostname(window.location.hostname);
      setDocumentCookie(request.name, request.value, domain);
      return Promise.resolve();
    }
    case 'remove_cookie': {
      const domain = getRootDomainFromHostname(window.location.hostname);
      removeDocumentCookie(request.name, domain);
      return Promise.resolve();
    }
    case 'highlight_fragments':
      highlightFragments();
      return Promise.resolve();
      break;
    case 'get_fragments':
      return Promise.resolve(getFragments());
      break;
    case 'get_fstrz_debug_script_tag':
      return Promise.resolve(getFstrzDebugScript());
      break;
    case 'show_lazyloaded_image':
      addOverlayOnLazyloadedImages();
      return Promise.resolve();
    case 'get_frz_flags':
      return Promise.resolve(getFrzFlags());
      break;
    case 'get_target_label':
      return Promise.resolve(getTargetLabel());
    case 'get_page_type':
      return Promise.resolve(getPageType());
    default:
      return Promise.reject('unexpected message');
  }
});
