/**
 * Fasterize CSS Selector Picker - Content Script
 * Injected programmatically by background (main.js) into the target page.
 *
 * Selector generator limited to the cssauron-compatible subset:
 * #id, .class, tag, [attr="val"], >, descendant, :nth-of-type(n)
 * NO :has, :is, :where, :not, or other advanced pseudo-classes.
 */

/* global chrome, browser */

var browserApi = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

// ─── Selector Generator ───────────────────────────────────────────────────────

function generateSelector(el) {
  // 1. Unique ID
  if (el.id && !looksGenerated(el.id)) {
    var idSelector = '#' + cssEscape(el.id);
    if (isUnique(idSelector, el)) return idSelector;
  }

  // 2. Unique data-* attribute
  var attrs = Array.from(el.attributes);
  for (var i = 0; i < attrs.length; i++) {
    var attr = attrs[i];
    if (attr.name.startsWith('data-') && attr.value && !looksGenerated(attr.value)) {
      var dataSelector = '[' + attr.name + '="' + cssEscapeAttr(attr.value) + '"]';
      if (isUnique(dataSelector, el)) return dataSelector;
    }
  }

  // 3. Build path walking up ancestors
  var path = [];
  var current = el;

  while (current && current !== document.body && current !== document.documentElement) {
    var segment = current.tagName.toLowerCase();

    // Add meaningful classes (filter auto-generated)
    var meaningfulClasses = Array.from(current.classList)
      .filter(function (c) { return !looksGenerated(c); })
      .slice(0, 2);

    if (meaningfulClasses.length) {
      segment += '.' + meaningfulClasses.map(cssEscape).join('.');
    }

    path.unshift(segment);

    // Check if path so far is unique
    var candidate = path.join(' > ');
    if (isUnique(candidate, el)) return candidate;

    // If parent has a unique ID, anchor there
    if (current.parentElement && current.parentElement.id && !looksGenerated(current.parentElement.id)) {
      var anchoredPath = ['#' + cssEscape(current.parentElement.id)].concat(path);
      var anchored = anchoredPath.join(' > ');
      if (isUnique(anchored, el)) return anchored;
    }

    current = current.parentElement;
  }

  // 4. Fallback: nth-child path
  return buildNthChildPath(el);
}

function buildNthChildPath(el) {
  var segments = [];
  var current = el;

  while (current && current !== document.body && current !== document.documentElement) {
    var tag = current.tagName.toLowerCase();
    var parent = current.parentElement;

    if (parent) {
      var currentRef = current;
      var siblings = Array.from(parent.children).filter(function (child) {
        return child.tagName === currentRef.tagName;
      });
      if (siblings.length > 1) {
        var index = siblings.indexOf(current) + 1;
        segments.unshift(tag + ':nth-of-type(' + index + ')');
      } else {
        segments.unshift(tag);
      }
    } else {
      segments.unshift(tag);
    }

    current = parent;

    // Check uniqueness at each step
    var candidate = segments.join(' > ');
    if (isUnique(candidate, el)) return candidate;
  }

  return segments.join(' > ');
}

function isUnique(selector, target) {
  try {
    var matches = document.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === target;
  } catch (e) {
    return false;
  }
}

function looksGenerated(value) {
  // Hash-like suffixes, very long strings, CSS module patterns
  return (
    /[_-][a-f0-9]{5,}/i.test(value) ||
    /^[a-z]{1,3}-[a-z0-9]{6,}/i.test(value) ||
    value.length > 40
  );
}

function cssEscape(value) {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(value);
  }
  return value.replace(/([^\w-])/g, '\\$1');
}

function cssEscapeAttr(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// ─── Picker State ─────────────────────────────────────────────────────────────

var isActive = false;
var isListMode = false;
var shadowHost = null;
var shadowRoot = null;
var svgOverlay = null;

// Hover state
var hoverElement = null;
var hoverRect = null;

// List mode: hovered sibling group
var hoveredListElements = [];
var hoveredListRects = [];

// Selected state
var selectedElements = [];
var selectedRects = [];

// Current computed selector & preview
var currentSelector = '';
var currentPreviewText = '';
var currentMatchCount = 0;

// UI elements
var selectorDisplay = null;
var validateBtn = null;
var listModeBtn = null;
var anchorBtn = null;
var panelEl = null;

// Panel anchor position: 'right' or 'left'
var panelAnchor = 'right';

// Body padding backup
var originalBodyPaddingTop = '';

// Font link element injected into host page
var fontLink = null;

// Port to service worker
var pickerPort = null;

// ─── Message Listener ─────────────────────────────────────────────────────────

browserApi.runtime.onMessage.addListener(function (message) {
  if (message.type === 'FSTRZ_ACTIVATE_PICKER') {
    activate();
  }
});

// ─── Styles ───────────────────────────────────────────────────────────────────

var STYLES = [
  '* { box-sizing: border-box; margin: 0; padding: 0; }',

  '.fstrz-header {',
  '  position: fixed; top: 0; left: 0; right: 0;',
  '  display: flex; flex-direction: column; gap: 4px;',
  '  padding: 10px 20px;',
  '  background: #61CED1; color: #073148;',
  '  font-family: Poppins, sans-serif;',
  '  font-size: 14px; pointer-events: auto;',
  '  z-index: 1;',
  '}',

  '.fstrz-header-line1 {',
  '  display: flex; align-items: center; gap: 10px;',
  '}',

  '.fstrz-header-icon {',
  '  display: flex; align-items: center; justify-content: center;',
  '  width: 28px; height: 28px; flex-shrink: 0;',
  '}',

  '.fstrz-header-title { font-weight: 600; font-size: 15px; white-space: nowrap; }',

  '.fstrz-header-spacer { flex: 1; }',

  '.fstrz-close-btn {',
  '  display: flex; align-items: center; justify-content: center;',
  '  width: 28px; height: 28px; flex-shrink: 0;',
  '  background: transparent; border: none; cursor: pointer;',
  '  border-radius: 4px; color: #073148; transition: background 0.15s;',
  '}',

  '.fstrz-close-btn:hover { background: rgba(7,49,72,0.1); }',

  '.fstrz-header-line2 {',
  '  font-size: 12px; opacity: 0.85; line-height: 1.4;',
  '}',

  /* ── Floating Panel ── */
  '.fstrz-panel {',
  '  position: fixed; bottom: 20px;',
  '  width: 286px; padding: 18px;',
  '  background: #FFFFFF; border: 1px solid #E7EBED;',
  '  border-radius: 8px;',
  '  box-shadow: 3px 3px 16px 0px rgba(53,64,82,0.2);',
  '  font-family: Poppins, sans-serif; font-size: 13px;',
  '  pointer-events: auto; z-index: 1;',
  '  display: flex; flex-direction: column; gap: 10px;',
  '  right: 20px;',
  '  transition: transform 0.25s ease;',
  '}',

  '.fstrz-panel.anchor-left { transform: translateX(calc(-100vw + 100% + 40px)); }',

  '.fstrz-panel-controls {',
  '  display: flex; justify-content: space-between; align-items: center;',
  '}',

  '.fstrz-anchor-btn {',
  '  display: flex; align-items: center; justify-content: center;',
  '  width: 32px; height: 32px;',
  '  border: 1px solid #E7EBED; border-radius: 4px;',
  '  background: #FFFFFF; cursor: pointer; color: #526F7F;',
  '  transition: background 0.15s;',
  '}',

  '.fstrz-anchor-btn:hover { background: #F5F5F5; }',

  '.fstrz-list-btn {',
  '  display: flex; align-items: center; gap: 6px;',
  '  padding: 6px 10px;',
  '  border: 1px solid #E7EBED; border-radius: 4px;',
  '  background: #FFFFFF; cursor: pointer;',
  '  color: #526F7F; font-family: Poppins, sans-serif; font-size: 12px;',
  '  transition: all 0.15s;',
  '}',

  '.fstrz-list-btn:hover { background: #F5F5F5; }',

  '.fstrz-list-btn.active {',
  '  background: #DBF4F5; border-color: #61CED1; color: #073148;',
  '}',

  '.fstrz-selector-display {',
  '  font-family: "Courier Prime", Arial, sans-serif;',
  '  font-size: 13px; background: #F5F5F5;',
  '  padding: 8px 10px; border-radius: 4px;',
  '  border: 1px solid #E7EBED;',
  '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
  '  color: #8297A3;',
  '}',

  '.fstrz-selector-display.has-value { color: #073148; }',

  '.fstrz-validate-btn {',
  '  width: 100%; padding: 9px 0;',
  '  border: none; border-radius: 4px;',
  '  font-family: Poppins, sans-serif; font-size: 13px; font-weight: 600;',
  '  cursor: pointer; transition: background 0.15s;',
  '  background: #61CED1; color: #073148;',
  '}',

  '.fstrz-validate-btn:hover { background: #073148; color: #FFFFFF; }',

  '.fstrz-validate-btn:disabled {',
  '  background: #E7EBED; color: #8297A3; cursor: default;',
  '}',

  '.fstrz-svg-overlay {',
  '  position: fixed; top: 0; left: 0; width: 100%; height: 100%;',
  '  pointer-events: none; z-index: 0;',
  '}',
].join('\n');

// ─── SVG Icons (inline, no external deps) ─────────────────────────────────────

var CROSSHAIR_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>';

var LIST_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';

var CLOSE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

var ARROW_RIGHT_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

var ARROW_LEFT_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>';

// ─── Activation ───────────────────────────────────────────────────────────────

function activate() {
  if (isActive) return;
  isActive = true;
  isListMode = false;
  panelAnchor = 'right';
  selectedElements = [];
  selectedRects = [];
  hoveredListElements = [];
  hoveredListRects = [];
  currentSelector = '';
  currentPreviewText = '';
  currentMatchCount = 0;

  // Open port to service worker
  pickerPort = browserApi.runtime.connect({ name: 'fstrz-picker' });
  pickerPort.onDisconnect.addListener(function () {
    console.log('Fasterize picker: port disconnected (service worker stopped)');
    pickerPort = null;
  });

  // Save and adjust body padding for header
  originalBodyPaddingTop = document.body.style.paddingTop;

  // Create Shadow DOM host
  shadowHost = document.createElement('div');
  shadowHost.id = 'fstrz-picker-host';
  shadowHost.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none;';
  document.documentElement.appendChild(shadowHost);

  // Inject Google Fonts <link> into the host page <head>
  fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&family=Courier+Prime&display=swap';
  document.head.appendChild(fontLink);

  shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

  // Inject styles via adoptedStyleSheets (CSP-safe)
  var sheet = new CSSStyleSheet();
  sheet.replaceSync(STYLES);
  shadowRoot.adoptedStyleSheets = [sheet];

  // Create SVG overlay for highlights
  svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgOverlay.setAttribute('class', 'fstrz-svg-overlay');
  shadowRoot.appendChild(svgOverlay);

  // Create header (2 lines)
  var header = document.createElement('div');
  header.className = 'fstrz-header';
  header.innerHTML =
    '<div class="fstrz-header-line1">' +
      '<div class="fstrz-header-icon">' + CROSSHAIR_SVG + '</div>' +
      '<span class="fstrz-header-title">Element Picker</span>' +
      '<div class="fstrz-header-spacer"></div>' +
      '<button class="fstrz-close-btn" id="fstrz-close" title="Close">' + CLOSE_SVG + '</button>' +
    '</div>' +
    '<div class="fstrz-header-line2">' +
      '<strong>Warning</strong>: JavaScript is disabled on this page \u2014 Only the elements visible here can be targeted by EdgeSEO.' +
    '</div>';
  shadowRoot.appendChild(header);

  // Adjust body padding after header is in DOM
  requestAnimationFrame(function () {
    var headerHeight = header.getBoundingClientRect().height;
    var currentPadding = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
    document.body.style.paddingTop = (currentPadding + headerHeight) + 'px';
  });

  // Create floating panel
  panelEl = document.createElement('div');
  panelEl.className = 'fstrz-panel';
  panelEl.innerHTML =
    '<div class="fstrz-panel-controls">' +
      '<button class="fstrz-anchor-btn" id="fstrz-anchor" title="Move panel">' + ARROW_LEFT_SVG + '</button>' +
      '<button class="fstrz-list-btn" id="fstrz-list-mode">' + LIST_SVG + ' Select list</button>' +
    '</div>' +
    '<div class="fstrz-selector-display" id="fstrz-selector">No element selected</div>' +
    '<button class="fstrz-validate-btn" id="fstrz-validate" disabled>Validate</button>';
  shadowRoot.appendChild(panelEl);

  // Cache UI refs
  selectorDisplay = shadowRoot.getElementById('fstrz-selector');
  validateBtn = shadowRoot.getElementById('fstrz-validate');
  listModeBtn = shadowRoot.getElementById('fstrz-list-mode');
  anchorBtn = shadowRoot.getElementById('fstrz-anchor');

  // Button events
  var closeBtn = shadowRoot.getElementById('fstrz-close');
  if (closeBtn) closeBtn.addEventListener('click', cancel);
  if (validateBtn) validateBtn.addEventListener('click', validate);
  if (listModeBtn) listModeBtn.addEventListener('click', toggleListMode);
  if (anchorBtn) anchorBtn.addEventListener('click', togglePanelAnchor);

  // Create hover rect in SVG
  hoverRect = createSvgRect('rgba(97,206,209,0.10)', '#61CED1');
  hoverRect.style.display = 'none';
  svgOverlay.appendChild(hoverRect);

  // Document event listeners (capture phase)
  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('mouseout', onMouseOut, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('scroll', onScrollResize, true);
  window.addEventListener('resize', onScrollResize);
}

// ─── SVG Helpers ──────────────────────────────────────────────────────────────

function createSvgRect(fill, stroke) {
  var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('fill', fill);
  rect.setAttribute('stroke', stroke);
  rect.setAttribute('stroke-width', '2');
  rect.setAttribute('rx', '2');
  return rect;
}

function positionSvgRect(rect, el) {
  var bounds = el.getBoundingClientRect();
  rect.setAttribute('x', String(bounds.left));
  rect.setAttribute('y', String(bounds.top));
  rect.setAttribute('width', String(bounds.width));
  rect.setAttribute('height', String(bounds.height));
}

// ─── List Selector Algorithm (Automa-style) ───────────────────────────────────

function findElementList(el) {
  return getElementList(el, 50, []);
}

function getElementList(el, maxDepth, paths) {
  if (maxDepth === 0 || !el || el.tagName === 'BODY' || el.tagName === 'HTML') return null;

  var segment = el.tagName.toLowerCase();
  var result = getAllSiblings(el, paths.join(' > '));

  if (result.index !== 1) segment += ':nth-of-type(' + result.index + ')';
  paths.unshift(segment);

  if (result.elements.length <= 1) {
    return getElementList(el.parentElement, maxDepth - 1, paths);
  }

  return result.elements;
}

function getAllSiblings(el, subSelector) {
  var siblings = [el];
  var index = 1;

  var isValid = function (element) {
    var sameTag = el.tagName === element.tagName;
    if (!sameTag) return false;
    if (!subSelector) return true;
    try {
      return !!element.querySelector(subSelector);
    } catch (e) {
      return false;
    }
  };

  // Walk previous siblings
  var prev = el;
  while ((prev = prev.previousElementSibling)) {
    if (isValid(prev)) {
      siblings.unshift(prev);
      index++;
    }
  }

  // Walk next siblings
  var next = el;
  while ((next = next.nextElementSibling)) {
    if (isValid(next)) siblings.push(next);
  }

  return { elements: siblings, index: index };
}

function generateListSelector(elements) {
  if (elements.length === 0) return '';
  var firstEl = elements[0];
  var parent = firstEl.parentElement;
  if (!parent) return generateSelector(firstEl);

  var parentSel = generateSelector(parent);
  var tag = firstEl.tagName.toLowerCase();
  return parentSel + ' > ' + tag;
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

function onMouseOver(e) {
  if (!isActive) return;
  var el = e.target;

  // Skip our own overlay
  if (el === shadowHost || (shadowHost && shadowHost.contains(el))) return;

  hoverElement = el;

  if (isListMode) {
    clearHoveredListRects();
    var listElements = findElementList(el);
    if (listElements && listElements.length > 1) {
      hoveredListElements = listElements;
      for (var i = 0; i < listElements.length; i++) {
        var rect = createSvgRect('rgba(255,152,0,0.12)', '#FF9800');
        positionSvgRect(rect, listElements[i]);
        if (svgOverlay) svgOverlay.appendChild(rect);
        hoveredListRects.push(rect);
      }
    } else {
      hoveredListElements = [];
      if (hoverRect) {
        positionSvgRect(hoverRect, el);
        hoverRect.style.display = '';
      }
    }
  } else {
    if (hoverRect) {
      positionSvgRect(hoverRect, el);
      hoverRect.style.display = '';
    }
  }

  if (el instanceof HTMLElement) {
    el.style.cursor = 'crosshair';
  }
}

function onMouseOut(e) {
  if (!isActive) return;
  var el = e.target;

  if (el === hoverElement) {
    if (hoverRect) hoverRect.style.display = 'none';
    if (isListMode) clearHoveredListRects();
    if (el instanceof HTMLElement) el.style.cursor = '';
    hoverElement = null;
  }
}

function onClick(e) {
  if (!isActive) return;
  var el = e.target;

  // Skip clicks on our overlay
  if (el === shadowHost || (shadowHost && shadowHost.contains(el))) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  // Clear previous selection
  clearSelectedRects();

  if (isListMode && hoveredListElements.length > 1) {
    selectedElements = hoveredListElements.slice();
    for (var i = 0; i < selectedElements.length; i++) {
      var rect = createSvgRect('rgba(76,175,80,0.14)', '#4CAF50');
      positionSvgRect(rect, selectedElements[i]);
      if (svgOverlay) svgOverlay.appendChild(rect);
      selectedRects.push(rect);
    }
    clearHoveredListRects();

    currentSelector = generateListSelector(selectedElements);
    currentPreviewText = selectedElements
      .map(function (el) { return (el.textContent || '').trim().substring(0, 50); })
      .join(' | ');
  } else {
    selectedElements = [el];
    var singleRect = createSvgRect('rgba(76,175,80,0.14)', '#4CAF50');
    positionSvgRect(singleRect, el);
    if (svgOverlay) svgOverlay.appendChild(singleRect);
    selectedRects = [singleRect];

    currentSelector = generateSelector(el);
    currentPreviewText = (el.textContent || '').trim().substring(0, 100);
  }

  // Count matches
  try {
    currentMatchCount = document.querySelectorAll(currentSelector).length;
  } catch (e) {
    currentMatchCount = selectedElements.length;
  }

  updatePanelUI();
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    cancel();
  }
}

function onScrollResize() {
  if (!isActive) return;
  if (hoverElement && hoverRect && hoverRect.style.display !== 'none') {
    positionSvgRect(hoverRect, hoverElement);
  }
  hoveredListElements.forEach(function (el, i) {
    if (hoveredListRects[i]) positionSvgRect(hoveredListRects[i], el);
  });
  selectedElements.forEach(function (el, i) {
    if (selectedRects[i]) positionSvgRect(selectedRects[i], el);
  });
}

// ─── Panel UI Updates ─────────────────────────────────────────────────────────

function updatePanelUI() {
  if (selectorDisplay) {
    if (currentSelector) {
      selectorDisplay.textContent = currentSelector;
      selectorDisplay.title = currentSelector;
      selectorDisplay.classList.add('has-value');
    } else {
      selectorDisplay.textContent = 'No element selected';
      selectorDisplay.title = '';
      selectorDisplay.classList.remove('has-value');
    }
  }

  if (validateBtn) {
    validateBtn.disabled = selectedElements.length === 0;
    if (currentMatchCount > 0) {
      validateBtn.textContent = 'Validate (' + currentMatchCount + ' match' + (currentMatchCount > 1 ? 'es' : '') + ')';
    } else {
      validateBtn.textContent = 'Validate';
    }
  }
}

// ─── Toggle List Mode ─────────────────────────────────────────────────────────

function toggleListMode() {
  isListMode = !isListMode;

  if (listModeBtn) {
    listModeBtn.classList.toggle('active', isListMode);
  }

  clearSelectedRects();
  clearHoveredListRects();
  selectedElements = [];
  currentSelector = '';
  currentPreviewText = '';
  currentMatchCount = 0;
  updatePanelUI();
}

// ─── Toggle Panel Anchor ──────────────────────────────────────────────────────

function togglePanelAnchor() {
  if (panelAnchor === 'right') {
    panelAnchor = 'left';
    if (panelEl) panelEl.classList.add('anchor-left');
    if (anchorBtn) anchorBtn.innerHTML = ARROW_RIGHT_SVG;
  } else {
    panelAnchor = 'right';
    if (panelEl) panelEl.classList.remove('anchor-left');
    if (anchorBtn) anchorBtn.innerHTML = ARROW_LEFT_SVG;
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function validate() {
  if (selectedElements.length === 0) return;

  if (pickerPort) {
    pickerPort.postMessage({
      type: 'FSTRZ_SELECTOR_PICKED',
      selector: currentSelector,
      previewText: currentPreviewText,
      matchCount: currentMatchCount,
    });
  }
  deactivate();
}

function cancel() {
  if (pickerPort) {
    pickerPort.postMessage({ type: 'FSTRZ_PICK_CANCELLED' });
  }
  deactivate();
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

function clearSelectedRects() {
  selectedRects.forEach(function (r) { r.remove(); });
  selectedRects = [];
}

function clearHoveredListRects() {
  hoveredListRects.forEach(function (r) { r.remove(); });
  hoveredListRects = [];
  hoveredListElements = [];
}

function deactivate() {
  isActive = false;

  if (hoverElement instanceof HTMLElement) {
    hoverElement.style.cursor = '';
  }
  hoverElement = null;
  hoverRect = null;

  selectedElements = [];
  selectedRects = [];
  hoveredListElements = [];
  hoveredListRects = [];
  currentSelector = '';
  currentPreviewText = '';
  currentMatchCount = 0;

  // Reset panel anchor
  panelAnchor = 'right';

  // Restore body padding
  document.body.style.paddingTop = originalBodyPaddingTop;
  originalBodyPaddingTop = '';

  // Disconnect port
  if (pickerPort) pickerPort.disconnect();
  pickerPort = null;

  if (fontLink) fontLink.remove();
  fontLink = null;

  if (shadowHost) shadowHost.remove();
  shadowHost = null;
  shadowRoot = null;
  svgOverlay = null;
  selectorDisplay = null;
  validateBtn = null;
  listModeBtn = null;
  anchorBtn = null;
  panelEl = null;

  document.removeEventListener('mouseover', onMouseOver, true);
  document.removeEventListener('mouseout', onMouseOut, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('scroll', onScrollResize, true);
  window.removeEventListener('resize', onScrollResize);
}
