/* those methods are executed in the context of the current tab */

function determineConnectionInfo() {
  if (window.PerformanceNavigationTiming) {
    const ntEntry = performance.getEntriesByType('navigation')[0];
    return ntEntry.nextHopProtocol;
  }
}

function highlightFragments() {
  const fragments = document.querySelectorAll('[data-fstrz-fragment-id]');
  fragments.forEach(f => {
    f.style.border = '5px solid #fa9730';
  });
}

function getFragments() {
  const fragments = document.querySelectorAll('[data-fstrz-fragment-id]');
  const res = Array.prototype.slice.call(fragments).map(fragment => fragment.outerHTML);
  return res;
}

function getDeferjsDebug() {
  var s = document.createElement('script');
  s.setAttribute('type', 'text/javascript');
  s.setAttribute('src', chrome.extension.getURL('show_deferjs_trace.js'));
  document.body.appendChild(s);
}

function addOverlayOnLazyloadedImages() {
  var node = document.createElement('style');
  node.innerHTML = 'img[data-lzled], img.lazyloaded { border: 3px solid #ff0090; box-sizing: border-box;}';
  document.body.appendChild(node);
}

browser.runtime.onMessage.addListener((request, sender) => {
  switch (request.action) {
    case 'check_connection_info':
      return Promise.resolve(determineConnectionInfo());
      break;
    case 'highlight_fragments':
      highlightFragments();
      return Promise.resolve();
      break;
    case 'get_fragments':
      return Promise.resolve(getFragments());
      break;
    case 'get_deferjs_debug':
      return Promise.resolve(getDeferjsDebug());
      break;
    case 'show_lazyloaded_image':
      addOverlayOnLazyloadedImages()
      return Promise.resolve();
    default:
      return Promise.reject('unexpected message');
  }
});
