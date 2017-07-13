/* those methods are executed in the context of the current tab */

function determineConnectionInfo() {
  return browser.loadTimes().connectionInfo;
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
    default:
      return Promise.reject('unexpected message');
  }
});
