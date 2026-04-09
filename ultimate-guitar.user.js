// ==UserScript==
// @name         Ultimate Guitar Layout Optimizer
// @author       Luuk Kablan
// @namespace    https://github.com/LuckyLuuk12/UserScripts
// @updateURL    https://raw.githubusercontent.com/LuckyLuuk12/UserScripts/main/ultimate-guitar.user.js
// @downloadURL  https://raw.githubusercontent.com/LuckyLuuk12/UserScripts/main/ultimate-guitar.user.js
// @source       https://github.com/LuckyLuuk12/UserScripts/blob/main/ultimate-guitar.user.js
// @homepageURL  https://github.com/LuckyLuuk12/UserScripts
// @version      2.2.3
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
  const CHORD_TEXT_RE = /^[A-G](?:#|b)?(?:m|maj|min|sus|add|dim|aug)?\d*(?:\/[A-G](?:#|b)?)?$/;
  const PROMO_TEXT_PATTERNS = [
    /your ai guitar coach/i,
    /welcome offer/i,
    /try now/i,
    /powered by/i
  ];

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

  function findHeadingByText(text, root = document) {
    const needle = normalizeText(text);
    return Array.from(root.querySelectorAll('h1, h2, h3, h4')).find(h => normalizeText(h.textContent) === needle);
  }

  function headingSet(root) {
    return new Set(
      Array.from(root.querySelectorAll('h2, h3')).map(h => normalizeText(h.textContent))
    );
  }

  function findMoreVersionsContainer() {
    const byAria = Array.from(document.querySelectorAll('[aria-label]')).find(el => normalizeText(el.getAttribute('aria-label')) === 'more versions');
    if (byAria) {
      return byAria.closest('aside, section, div') || byAria;
    }

    const heading = Array.from(document.querySelectorAll('h2, h3')).find(h => normalizeText(h.textContent) === 'more versions');
    return heading ? (heading.closest('aside, section, div') || heading.parentElement) : null;
  }

  function findRightSidebar() {
    const main = findMain();
    const scope = main || document;
    const chordsHeading = findHeadingByText('Chords', scope);
    if (!chordsHeading) return null;

    let node = chordsHeading.closest('section, aside, article, div') || chordsHeading.parentElement;
    while (node && node !== document.body) {
      const headings = headingSet(node);
      if (
        headings.has('chords') &&
        (headings.has('play next') || headings.has('strumming pattern') || headings.has('get effects'))
      ) {
        return node;
      }
      node = node.parentElement;
    }

    return null;
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

    main.style.setProperty('width', '100%', 'important');
    main.style.setProperty('max-width', 'none', 'important');
    main.style.setProperty('margin-left', '0', 'important');
    main.style.setProperty('margin-right', '0', 'important');
    main.style.setProperty('box-sizing', 'border-box', 'important');

    const topContainer = main.firstElementChild;
    if (topContainer) {
      topContainer.style.setProperty('width', '100%', 'important');
      topContainer.style.setProperty('max-width', 'none', 'important');
      topContainer.style.setProperty('margin', '0', 'important');
      topContainer.style.setProperty('box-sizing', 'border-box', 'important');

      Array.from(topContainer.children).forEach(child => {
        child.style.setProperty('max-width', 'none', 'important');
        child.style.setProperty('box-sizing', 'border-box', 'important');
      });
    }

    const appShell = document.querySelector('.XSbtP');
    if (appShell) {
      appShell.style.setProperty('--ug-layout-center-column-width', '100%', 'important');
      appShell.style.setProperty('max-width', 'none', 'important');
      appShell.style.setProperty('width', '100%', 'important');
    }
    document.documentElement.style.setProperty('--ug-layout-center-column-width', '100%');
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

    const searchBox = navbar.querySelector('input[type="search"], [role="searchbox"]');
    let navTarget = null;

    if (searchBox) {
      let cursor = searchBox.closest('div');
      while (cursor && cursor !== navbar) {
        const hasTopNavLinks = !!cursor.querySelector('ul[aria-label*="Main" i], [role="list"] a[href]');
        if (hasTopNavLinks) {
          navTarget = cursor;
          break;
        }
        cursor = cursor.parentElement;
      }
    }

    if (!navTarget) {
      navTarget = navbar.firstElementChild || navbar;
    }

    const existingParent = signUp.parentElement === logIn.parentElement ? signUp.parentElement : null;
    if (existingParent) {
      existingParent.style.display = 'inline-flex';
      existingParent.style.width = 'auto';
      existingParent.style.gap = '8px';
      existingParent.style.flex = '0 0 auto';
      existingParent.style.alignItems = 'center';
      existingParent.style.justifySelf = 'end';
      navTarget.appendChild(existingParent);
      console.log('[UG Script] Moved login buttons to navbar');
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-flex';
    wrapper.style.gap = '8px';
    wrapper.style.width = 'auto';
    wrapper.style.flex = '0 0 auto';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifySelf = 'end';
    wrapper.appendChild(signUp);
    wrapper.appendChild(logIn);
    navTarget.appendChild(wrapper);
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

  function makeLeftSidebarSticky(leftContainer) {
    if (!leftContainer) return;

    leftContainer.style.setProperty('position', 'sticky', 'important');
    leftContainer.style.setProperty('top', '76px', 'important');
    leftContainer.style.setProperty('align-self', 'start', 'important');
    leftContainer.style.setProperty('max-height', 'calc(100vh - 90px)', 'important');
    leftContainer.style.setProperty('overflow-y', 'auto', 'important');
    leftContainer.style.setProperty('overscroll-behavior', 'contain', 'important');
    leftContainer.style.setProperty('padding-right', '6px', 'important');
  }

  function findPanelByHeading(sidebar, headingText) {
    if (!sidebar) return null;

    const heading = findHeadingByText(headingText, sidebar);
    if (!heading) return null;

    let panel = heading.closest('section, article, div') || heading.parentElement;
    while (panel && panel.parentElement && panel.parentElement !== sidebar) {
      const parentHeadings = headingSet(panel.parentElement);
      if (parentHeadings.has('chords') || parentHeadings.has('strumming pattern') || parentHeadings.has('get effects')) {
        break;
      }
      panel = panel.parentElement;
    }

    return panel;
  }

  function removePlayNextAndPromo(sidebar) {
    if (!sidebar) return;

    const playNextPanel = findPanelByHeading(sidebar, 'Play next');
    if (playNextPanel) {
      playNextPanel.remove();
      console.log('[UG Script] Removed Play next panel');
    }

    const promoCandidates = Array.from(sidebar.querySelectorAll('section, article, div')).filter(node => {
      const text = normalizeText(node.textContent);
      if (!text || text.length > 500) return false;
      if (node.querySelector('h2, h3')) return false;
      return PROMO_TEXT_PATTERNS.some(re => re.test(text));
    });

    promoCandidates.forEach(node => {
      const card = node.closest('section, article, div');
      if (card && card !== sidebar) {
        card.remove();
      }
    });
  }

  function moveChordsToLeftSidebar() {
    const layout = getChordsTargetSection();
    if (!layout) return;

    const { leftContainer, chordsSection } = layout;
    makeLeftSidebarSticky(leftContainer);
    if (leftContainer.contains(chordsSection)) return;

    leftContainer.insertBefore(chordsSection, leftContainer.firstChild);
    hideCollapseButtons(chordsSection);
    hideCollapseButtons(chordsSection.parentElement);
    console.log('[UG Script] Moved chords to More Versions sidebar');
  }

  function findTwoColumnLayoutRoot(rightSidebar) {
    const main = findMain();
    if (!main || !rightSidebar) return null;

    const tabCode = main.querySelector('code');
    if (!tabCode) return null;

    let node = tabCode.closest('section, article, div');
    while (node && node !== main) {
      if (node.contains(rightSidebar) && node.contains(tabCode)) {
        return node;
      }
      node = node.parentElement;
    }

    return null;
  }

  function collapseMainToSingleColumn(rightSidebar) {
    const layoutRoot = findTwoColumnLayoutRoot(rightSidebar);
    if (!layoutRoot) return;

    layoutRoot.style.setProperty('display', 'grid', 'important');
    layoutRoot.style.setProperty('grid-template-columns', 'minmax(0, 1fr)', 'important');
    layoutRoot.style.setProperty('column-gap', '0', 'important');
    layoutRoot.style.setProperty('width', '100%', 'important');
    layoutRoot.style.setProperty('max-width', 'none', 'important');

    Array.from(layoutRoot.children).forEach(child => {
      if (child !== rightSidebar) {
        child.style.setProperty('grid-column', '1 / -1', 'important');
        child.style.setProperty('max-width', 'none', 'important');
      }
    });
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
      removePlayNextAndPromo(sidebar);
      moveChordsToLeftSidebar();
      hideSidebar(findRightSidebar());
      collapseMainToSingleColumn(findRightSidebar());
      updateChordsFontSize(getSavedChordsFontSize());
    });

    observer.observe(sidebar, { childList: true, subtree: true });
    sidebar.__ugChordsObserver = observer;
  }

  function reorganizeLayout() {
    if (hasReorganized) return;

    const main = findMain();
    const navbar = findNavbar();
    const leftContainer = findMoreVersionsContainer();
    const rightSidebar = findRightSidebar();
    if (!main || !navbar || !leftContainer || !rightSidebar) {
      setTimeout(reorganizeLayout, 150);
      return;
    }

    console.log('[UG Script] Starting layout reorganization');

    removeAds();
    dismissPopups();
    moveLoginButtonsToNavbar();
    applyMainLayoutOverrides();

    makeLeftSidebarSticky(leftContainer);
    removePlayNextAndPromo(rightSidebar);
    moveChordsToLeftSidebar();
    hideSidebar(rightSidebar);
    collapseMainToSingleColumn(rightSidebar);
    attachSidebarObserver(rightSidebar);

    updateChordsFontSize(getSavedChordsFontSize());
    observeSettingsPopups();
    setupSettingsButtonListener();

    hasReorganized = true;

    console.log('[UG Script] Layout reorganization complete');
  }

  function layoutNeedsReapply() {
    const leftContainer = findMoreVersionsContainer();
    const rightSidebar = findRightSidebar();
    const chordsInLeft = !!(leftContainer && findChordsSection(leftContainer));

    if (!leftContainer || !chordsInLeft) return true;
    if (rightSidebar && rightSidebar.style.display !== 'none') return true;
    return false;
  }

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reorganizeLayout);
  } else {
    reorganizeLayout();
  }

  // Auto-dismiss popups periodically
  setInterval(dismissPopups, 2000);

  // Re-apply layout when UG re-renders widgets without URL changes.
  setInterval(() => {
    if (!hasReorganized) {
      reorganizeLayout();
      return;
    }
    if (layoutNeedsReapply()) {
      hasReorganized = false;
      reorganizeLayout();
    }
  }, 1200);

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
