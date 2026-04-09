// ==UserScript==
// @name         Ultimate Guitar Layout Optimizer
// @author       Luuk Kablan
// @namespace    https://github.com/LuckyLuuk12/UserScripts
// @updateURL    https://raw.githubusercontent.com/LuckyLuuk12/UserScripts/main/ultimate-guitar.user.js
// @downloadURL  https://raw.githubusercontent.com/LuckyLuuk12/UserScripts/main/ultimate-guitar.user.js
// @source       https://github.com/LuckyLuuk12/UserScripts/blob/main/ultimate-guitar.user.js
// @homepageURL  https://github.com/LuckyLuuk12/UserScripts
// @version      2.2.0
// @description  Optimize Ultimate Guitar layout: remove ads, move chords to left sidebar, expand main content
// @match        https://tabs.ultimate-guitar.com/tab/*
// @match        https://www.ultimate-guitar.com/tab/*
// @run-at       document-end
// @grant        none
// @license      MIT
// @copyright    2025, Luuk Kablan
// ==/UserScript==

(function () {
  'use strict';

  // Licensed under the MIT License (see LICENSE in repository root).
  // Original author: Luuk Kablan

  let hasReorganized = false;
  const LS_KEY_CHORDS_FONT_SIZE = 'ug-chords-fontsize';
  const HEADING_HINTS = ['play next', 'chords', 'strumming pattern', 'get effects'];
  const CHORD_TEXT_RE = /^[A-G](?:#|b)?(?:m|maj|min|sus|add|dim|aug)?\d*(?:\/[A-G](?:#|b)?)?$/;

  function normalizeText(value) {
    return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function findButtonsByLabel(pattern, root = document) {
    return Array.from(root.querySelectorAll('button')).filter(btn => {
      const aria = normalizeText(btn.getAttribute('aria-label'));
      const text = normalizeText(btn.textContent);
      return pattern.test(aria) || pattern.test(text);
    });
  }

  function findNavbar() {
    return document.querySelector('[role="banner"], header');
  }

  function findMain() {
    return document.querySelector('main');
  }

  function findMoreVersionsContainer() {
    const byAria = Array.from(document.querySelectorAll('[aria-label]')).find(el => normalizeText(el.getAttribute('aria-label')) === 'more versions');
    if (byAria) {
      return byAria.closest('aside, section, div') || byAria;
    }

    const heading = Array.from(document.querySelectorAll('h2, h3')).find(h => normalizeText(h.textContent) === 'more versions');
    return heading ? (heading.closest('aside, section, div') || heading.parentElement) : null;
  }

  function scoreSidebarCandidate(node) {
    if (!node || node.querySelector('h1')) return -1;

    const headingSet = new Set(
      Array.from(node.querySelectorAll('h2, h3')).map(h => normalizeText(h.textContent))
    );

    let score = 0;
    HEADING_HINTS.forEach(hint => {
      if (headingSet.has(hint)) score += 1;
    });

    return score;
  }

  function findRightSidebar() {
    const main = findMain();
    if (!main) return null;

    let best = null;
    let bestScore = 0;
    let bestSize = Number.POSITIVE_INFINITY;

    const candidates = Array.from(main.querySelectorAll('aside, section, div'));
    for (const candidate of candidates) {
      const score = scoreSidebarCandidate(candidate);
      if (score < 2) continue;

      const size = candidate.querySelectorAll('*').length;
      if (score > bestScore || (score === bestScore && size < bestSize)) {
        best = candidate;
        bestScore = score;
        bestSize = size;
      }
    }

    return best;
  }

  function findChordsSection(root) {
    const scope = root || document;
    const heading = Array.from(scope.querySelectorAll('h2, h3')).find(h => normalizeText(h.textContent) === 'chords');
    if (!heading) return null;

    let node = heading.parentElement;
    while (node && node !== scope) {
      if (node.querySelector('[role="tablist"], [role="tabpanel"]')) {
        return node;
      }
      node = node.parentElement;
    }

    return heading.closest('section, article, div') || heading.parentElement;
  }

  function applyMainLayoutOverrides() {
    const main = findMain();
    if (!main) return;

    main.style.width = '100%';
    main.style.maxWidth = 'none';
    main.style.marginLeft = '0';
    main.style.marginRight = '0';
    main.style.boxSizing = 'border-box';

    const topContainer = main.firstElementChild;
    if (topContainer) {
      topContainer.style.width = '100%';
      topContainer.style.maxWidth = 'none';
      topContainer.style.margin = '0';
      topContainer.style.boxSizing = 'border-box';

      Array.from(topContainer.children).forEach(child => {
        child.style.maxWidth = 'none';
        child.style.boxSizing = 'border-box';
      });
    }

    document.documentElement.style.setProperty('--ug-layout-center-column-width', '100vw');
  }

  function hideSidebar(sidebar) {
    if (!sidebar) return;
    sidebar.style.display = 'none';
  }

  function hideCollapseButtons(root) {
    if (!root) return;

    const buttons = findButtonsByLabel(/collapse|expand/i, root);
    buttons.forEach(btn => {
      btn.style.display = 'none';
    });
  }

  function moveLoginButtonsToNavbar() {
    const navbar = findNavbar();
    if (!navbar) return;

    const signUp = findButtonsByLabel(/^sign up$/i)[0];
    const logIn = findButtonsByLabel(/^log in$/i)[0];
    if (!signUp || !logIn) return;
    if (navbar.contains(signUp) || navbar.contains(logIn)) return;

    const existingParent = signUp.parentElement === logIn.parentElement ? signUp.parentElement : null;
    if (existingParent) {
      navbar.appendChild(existingParent);
      console.log('[UG Script] Moved login buttons to navbar');
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.gap = '8px';
    wrapper.appendChild(signUp);
    wrapper.appendChild(logIn);
    navbar.appendChild(wrapper);
    console.log('[UG Script] Moved login buttons to navbar');
  }

  function removeAds() {
    const selectors = [
      '[id^="ad_"]',
      '[id^="google_ads"]',
      'bidding-wrapper',
      'bidding-unit',
      'iframe[src*="doubleclick"]',
      'iframe[src*="googlesyndication"]',
      '.adsbygoogle'
    ];

    document.querySelectorAll(selectors.join(',')).forEach(node => {
      node.remove();
    });
  }

  function getChordsTargetSection() {
    const leftContainer = findMoreVersionsContainer();
    if (!leftContainer) return null;

    const rightSidebar = findRightSidebar();
    const chordsSection = findChordsSection(rightSidebar || document);
    if (!chordsSection) return null;

    return { leftContainer, rightSidebar, chordsSection };
  }

  function moveChordsToLeftSidebar() {
    const layout = getChordsTargetSection();
    if (!layout) return;

    const { leftContainer, chordsSection } = layout;
    if (leftContainer.contains(chordsSection)) return;

    leftContainer.insertBefore(chordsSection, leftContainer.firstChild);
    hideCollapseButtons(chordsSection);
    hideCollapseButtons(chordsSection.parentElement);
    console.log('[UG Script] Moved chords to More Versions sidebar');
  }

  function updateChordsFontSize(sizeDelta) {
    const leftContainer = findMoreVersionsContainer() || document;
    const chordsSection = findChordsSection(leftContainer);
    if (!chordsSection) return;

    const textNodes = Array.from(chordsSection.querySelectorAll('span, a, button, div')).filter(el => {
      if (el.children.length > 0) return false;
      const text = (el.textContent || '').trim();
      if (text.length === 0 || text.length > 10) return false;
      return CHORD_TEXT_RE.test(text);
    });

    textNodes.forEach(el => {
      el.style.fontSize = sizeDelta === 0 ? '' : `calc(1em + ${sizeDelta * 0.15}em)`;
    });
  }

  function getSavedChordsFontSize() {
    return parseInt(localStorage.getItem(LS_KEY_CHORDS_FONT_SIZE) || '0', 10);
  }

  function setSavedChordsFontSize(value) {
    localStorage.setItem(LS_KEY_CHORDS_FONT_SIZE, String(value));
    updateChordsFontSize(value);
  }

  function patchSettingsPopup(dialog) {
    if (!dialog || dialog.__ugChordsFontSizePatched) return;
    if (normalizeText(dialog.getAttribute('role')) !== 'dialog') return;
    if (!/font size/i.test(dialog.textContent || '')) return;
    if (dialog.querySelector('.ug-chords-fontsize-setting')) return;

    const anchors = Array.from(dialog.querySelectorAll('div, section, article'));
    const fontSizeAnchor = anchors.find(el => /font size/i.test(normalizeText(el.textContent)) && el.querySelector('button, [role="spinbutton"]'));
    if (!fontSizeAnchor || !fontSizeAnchor.parentElement) return;

    const controlRow = document.createElement('div');
    controlRow.className = 'ug-chords-fontsize-setting';
    controlRow.style.display = 'flex';
    controlRow.style.alignItems = 'center';
    controlRow.style.gap = '8px';
    controlRow.style.marginTop = '8px';

    const label = document.createElement('div');
    label.textContent = 'Chords font size';
    label.style.fontWeight = '600';

    const minusBtn = document.createElement('button');
    minusBtn.type = 'button';
    minusBtn.setAttribute('aria-label', 'Decrement Chords Font size');
    minusBtn.textContent = '-';

    const valueNode = document.createElement('div');
    valueNode.className = 'ug-chords-fontsize-value';
    valueNode.style.minWidth = '20px';
    valueNode.style.textAlign = 'center';

    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.setAttribute('aria-label', 'Increment Chords Font size');
    plusBtn.textContent = '+';

    const min = -3;
    const max = 6;

    const updateValue = (newValue) => {
      valueNode.textContent = String(newValue);
      setSavedChordsFontSize(newValue);
    };

    minusBtn.addEventListener('click', () => {
      const current = getSavedChordsFontSize();
      if (current > min) updateValue(current - 1);
    });

    plusBtn.addEventListener('click', () => {
      const current = getSavedChordsFontSize();
      if (current < max) updateValue(current + 1);
    });

    controlRow.appendChild(label);
    controlRow.appendChild(minusBtn);
    controlRow.appendChild(valueNode);
    controlRow.appendChild(plusBtn);
    fontSizeAnchor.parentElement.insertBefore(controlRow, fontSizeAnchor.nextSibling);

    updateValue(getSavedChordsFontSize());
    dialog.__ugChordsFontSizePatched = true;
    console.log('[UG Script] Patched settings popup with chords font size control');
  }

  function observeSettingsPopups() {
    if (document.body.__ugSettingsObserver) return;

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;

          if (node.matches?.('[role="dialog"]')) {
            patchSettingsPopup(node);
          }

          if (node.querySelectorAll) {
            node.querySelectorAll('[role="dialog"]').forEach(patchSettingsPopup);
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    document.body.__ugSettingsObserver = observer;
  }

  function setupSettingsButtonListener() {
    const settingsBtn = findButtonsByLabel(/^settings$/i)[0] || document.querySelector('button[aria-label="Settings"]');
    if (!settingsBtn || settingsBtn.__ugSettingsHooked) return;

    settingsBtn.addEventListener('click', () => {
      setTimeout(() => {
        document.querySelectorAll('[role="dialog"]').forEach(patchSettingsPopup);
      }, 100);
    });

    settingsBtn.__ugSettingsHooked = true;
  }

  function dismissPopups() {
    const dismissButtons = findButtonsByLabel(/^dismiss$/i);
    dismissButtons.forEach(btn => {
      if (!btn.isConnected) return;
      btn.click();
    });

    const closeButtons = findButtonsByLabel(/^close$/i);
    closeButtons.forEach(btn => {
      const areaText = normalizeText(btn.closest('div, section, article')?.textContent);
      if (/sale|offer|pro access|ad|promotion/.test(areaText)) {
        btn.click();
      }
    });

    const privacyDialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(dialog => {
      return /privacy/i.test(dialog.textContent || '');
    });
    if (privacyDialog) {
      const disagree = findButtonsByLabel(/^disagree$/i, privacyDialog)[0];
      if (disagree) disagree.click();
    }
  }

  function attachSidebarObserver(sidebar) {
    if (!sidebar || sidebar.__ugChordsObserver) return;

    const observer = new MutationObserver(() => {
      moveChordsToLeftSidebar();
      hideSidebar(findRightSidebar());
      updateChordsFontSize(getSavedChordsFontSize());
    });

    observer.observe(sidebar, { childList: true, subtree: true });
    sidebar.__ugChordsObserver = observer;
  }

  function reorganizeLayout() {
    if (hasReorganized) return;

    const main = findMain();
    const navbar = findNavbar();
    if (!main || !navbar) {
      setTimeout(reorganizeLayout, 150);
      return;
    }

    hasReorganized = true;
    console.log('[UG Script] Starting layout reorganization');

    removeAds();
    dismissPopups();
    moveLoginButtonsToNavbar();
    applyMainLayoutOverrides();
    moveChordsToLeftSidebar();

    const rightSidebar = findRightSidebar();
    hideSidebar(rightSidebar);
    attachSidebarObserver(rightSidebar);

    updateChordsFontSize(getSavedChordsFontSize());
    observeSettingsPopups();
    setupSettingsButtonListener();

    console.log('[UG Script] Layout reorganization complete');
  }

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reorganizeLayout);
  } else {
    reorganizeLayout();
  }

  // Auto-dismiss popups periodically
  setInterval(dismissPopups, 2000);

  // Watch for URL changes (SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      hasReorganized = false;
      setTimeout(reorganizeLayout, 500);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
