/**
 * Fasterize CSS Selector Picker - Content Script
 * Injected programmatically by background (main.js) into the target page.
 *
 * Selector generator limited to the cssauron-compatible subset:
 * #id, .class, tag, [attr="val"], >, descendant, :nth-of-type(n)
 * NO :has, :is, :where, :not, or other advanced pseudo-classes.
 */

/* global chrome */

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
var countChip = null;
var validateBtn = null;
var instructionEl = null;

// ─── Message Listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(function (message) {
  if (message.type === 'FSTRZ_ACTIVATE_PICKER') {
    activate();
  }
});

// ─── Styles ───────────────────────────────────────────────────────────────────

var STYLES = [
  '* { box-sizing: border-box; margin: 0; padding: 0; }',

  '.fstrz-header {',
  '  position: fixed; top: 0; left: 0; right: 0;',
  '  display: flex; align-items: center; gap: 12px;',
  '  padding: 10px 20px;',
  '  background: #1a1a2e; color: #fff;',
  '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
  '  font-size: 14px; pointer-events: auto;',
  '  box-shadow: 0 2px 8px rgba(0,0,0,0.3); z-index: 1;',
  '}',

  '.fstrz-header-icon {',
  '  display: flex; align-items: center; justify-content: center;',
  '  width: 32px; height: 32px; flex-shrink: 0;',
  '}',

  '.fstrz-header-title { font-weight: 600; font-size: 15px; white-space: nowrap; }',

  '.fstrz-header-instruction { color: rgba(255,255,255,0.7); font-size: 13px; flex: 1; }',

  '.fstrz-footer {',
  '  position: fixed; bottom: 0; left: 0; right: 0;',
  '  display: flex; align-items: center; gap: 12px;',
  '  padding: 10px 20px;',
  '  background: #1a1a2e; color: #fff;',
  '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
  '  font-size: 14px; pointer-events: auto;',
  '  box-shadow: 0 -2px 8px rgba(0,0,0,0.3); z-index: 1;',
  '}',

  '.fstrz-selector-display {',
  '  flex: 1;',
  '  font-family: "SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace;',
  '  font-size: 13px; background: rgba(255,255,255,0.1);',
  '  padding: 6px 12px; border-radius: 4px;',
  '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
  '  color: rgba(255,255,255,0.6); min-width: 0;',
  '}',

  '.fstrz-selector-display.has-value { color: #fff; }',

  '.fstrz-count-chip {',
  '  display: none; align-items: center; gap: 4px;',
  '  padding: 4px 10px; border-radius: 12px;',
  '  background: rgba(76,175,80,0.2); color: #66BB6A;',
  '  font-size: 12px; font-weight: 600; white-space: nowrap;',
  '}',

  '.fstrz-count-chip.visible { display: flex; }',

  '.fstrz-toggle-btn {',
  '  display: flex; align-items: center; justify-content: center;',
  '  width: 36px; height: 36px;',
  '  border: 1px solid rgba(255,255,255,0.2); border-radius: 4px;',
  '  background: transparent; color: rgba(255,255,255,0.6);',
  '  cursor: pointer; flex-shrink: 0; transition: all 0.15s;',
  '}',

  '.fstrz-toggle-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }',

  '.fstrz-toggle-btn.active {',
  '  background: rgba(33,150,243,0.2); border-color: #2196F3; color: #2196F3;',
  '}',

  '.fstrz-btn {',
  '  padding: 7px 20px; border-radius: 4px; font-size: 13px; font-weight: 500;',
  '  cursor: pointer; border: none; white-space: nowrap; transition: all 0.15s;',
  '}',

  '.fstrz-btn-cancel {',
  '  background: transparent; border: 1px solid rgba(255,255,255,0.3); color: #fff;',
  '}',

  '.fstrz-btn-cancel:hover { background: rgba(255,255,255,0.1); }',

  '.fstrz-btn-validate { background: #4CAF50; color: #fff; }',
  '.fstrz-btn-validate:hover { background: #43A047; }',
  '.fstrz-btn-validate:disabled {',
  '  background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.3); cursor: default;',
  '}',

  '.fstrz-svg-overlay {',
  '  position: fixed; top: 0; left: 0; width: 100%; height: 100%;',
  '  pointer-events: none; z-index: 0;',
  '}',
].join('\n');

// ─── SVG Icons (inline, no external deps) ─────────────────────────────────────

var CROSSHAIR_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>';

var LIST_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';

// ─── Activation ───────────────────────────────────────────────────────────────

function activate() {
  if (isActive) return;
  isActive = true;
  isListMode = false;
  selectedElements = [];
  selectedRects = [];
  hoveredListElements = [];
  hoveredListRects = [];
  currentSelector = '';
  currentPreviewText = '';
  currentMatchCount = 0;

  // Create Shadow DOM host
  shadowHost = document.createElement('div');
  shadowHost.id = 'fstrz-picker-host';
  shadowHost.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none;';
  document.documentElement.appendChild(shadowHost);

  shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

  // Inject styles via adoptedStyleSheets (CSP-safe)
  var sheet = new CSSStyleSheet();
  sheet.replaceSync(STYLES);
  shadowRoot.adoptedStyleSheets = [sheet];

  // Create SVG overlay for highlights
  svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgOverlay.setAttribute('class', 'fstrz-svg-overlay');
  shadowRoot.appendChild(svgOverlay);

  // Create header
  var header = document.createElement('div');
  header.className = 'fstrz-header';
  header.innerHTML =
    '<div class="fstrz-header-icon">' + CROSSHAIR_SVG + '</div>' +
    '<span class="fstrz-header-title">Element Picker</span>' +
    '<span class="fstrz-header-instruction" id="fstrz-instruction">Click on an element to select it</span>';
  shadowRoot.appendChild(header);

  // Create footer
  var footer = document.createElement('div');
  footer.className = 'fstrz-footer';
  footer.innerHTML =
    '<span class="fstrz-selector-display" id="fstrz-selector">No element selected</span>' +
    '<span class="fstrz-count-chip" id="fstrz-count"></span>' +
    '<button class="fstrz-toggle-btn" id="fstrz-toggle" title="Toggle list selection">' + LIST_SVG + '</button>' +
    '<button class="fstrz-btn fstrz-btn-cancel" id="fstrz-cancel">Cancel</button>' +
    '<button class="fstrz-btn fstrz-btn-validate" id="fstrz-validate" disabled>Validate</button>';
  shadowRoot.appendChild(footer);

  // Cache UI refs
  selectorDisplay = shadowRoot.getElementById('fstrz-selector');
  countChip = shadowRoot.getElementById('fstrz-count');
  validateBtn = shadowRoot.getElementById('fstrz-validate');
  instructionEl = shadowRoot.getElementById('fstrz-instruction');

  // Button events
  var cancelBtn = shadowRoot.getElementById('fstrz-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', cancel);
  if (validateBtn) validateBtn.addEventListener('click', validate);
  var toggleBtn = shadowRoot.getElementById('fstrz-toggle');
  if (toggleBtn) toggleBtn.addEventListener('click', toggleListMode);

  // Create hover rect in SVG
  hoverRect = createSvgRect('rgba(33,150,243,0.08)', '#2196F3');
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

  updateFooterUI();
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

// ─── Footer UI Updates ────────────────────────────────────────────────────────

function updateFooterUI() {
  if (selectorDisplay) {
    if (currentSelector) {
      selectorDisplay.textContent = currentSelector;
      selectorDisplay.classList.add('has-value');
    } else {
      selectorDisplay.textContent = 'No element selected';
      selectorDisplay.classList.remove('has-value');
    }
  }

  if (countChip) {
    if (currentMatchCount > 0) {
      countChip.textContent = currentMatchCount + ' match' + (currentMatchCount > 1 ? 'es' : '');
      countChip.classList.add('visible');
    } else {
      countChip.classList.remove('visible');
    }
  }

  if (validateBtn) {
    validateBtn.disabled = selectedElements.length === 0;
  }
}

// ─── Toggle List Mode ─────────────────────────────────────────────────────────

function toggleListMode() {
  isListMode = !isListMode;
  var toggleBtn = shadowRoot ? shadowRoot.getElementById('fstrz-toggle') : null;
  if (toggleBtn) {
    toggleBtn.classList.toggle('active', isListMode);
  }

  if (instructionEl) {
    instructionEl.textContent = isListMode
      ? 'Hover to detect list, click to select all items'
      : 'Click on an element to select it';
  }

  clearSelectedRects();
  clearHoveredListRects();
  selectedElements = [];
  currentSelector = '';
  currentPreviewText = '';
  currentMatchCount = 0;
  updateFooterUI();
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function validate() {
  if (selectedElements.length === 0) return;

  chrome.runtime.sendMessage({
    type: 'FSTRZ_SELECTOR_PICKED',
    selector: currentSelector,
    previewText: currentPreviewText,
    matchCount: currentMatchCount,
  });
  deactivate();
}

function cancel() {
  chrome.runtime.sendMessage({
    type: 'FSTRZ_PICK_CANCELLED',
  });
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

  if (shadowHost) shadowHost.remove();
  shadowHost = null;
  shadowRoot = null;
  svgOverlay = null;
  selectorDisplay = null;
  countChip = null;
  validateBtn = null;
  instructionEl = null;

  document.removeEventListener('mouseover', onMouseOver, true);
  document.removeEventListener('mouseout', onMouseOut, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('scroll', onScrollResize, true);
  window.removeEventListener('resize', onScrollResize);
}
