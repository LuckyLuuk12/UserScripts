// ==UserScript==
// @name         Ultimate Guitar Layout Optimizer
// @author       Luuk Kablan
// @namespace    https://github.com/LuckyLuuk12/UserScripts
// @updateURL    https://raw.githubusercontent.com/LuckyLuuk12/UserScripts/main/ultimate-guitar.user.js
// @downloadURL  https://raw.githubusercontent.com/LuckyLuuk12/UserScripts/main/ultimate-guitar.user.js
// @source       https://github.com/LuckyLuuk12/UserScripts/blob/main/ultimate-guitar.user.js
// @homepageURL  https://github.com/LuckyLuuk12/UserScripts
// @version      2.1.0
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

  // Auto-dismiss paywall popups
  function dismissPopups() {
    // Find and click dismiss buttons on paywall popups
    const dismissButtons = document.querySelectorAll('.vepn3.H9V4X button[aria-label="Dismiss"]');
    dismissButtons.forEach(btn => {
      console.log('[UG Script] Auto-dismissing paywall popup');
      btn.click();
    });

    // Close header ad banner by clicking X button
    const headerAdClose = document.querySelector('.V732l button[aria-label="Close"]');
    if (headerAdClose) {
      console.log('[UG Script] Closing header ad banner');
      headerAdClose.click();
    }
  }


  function moveChordsToLeftSidebar() {
    const leftSidebar = document.querySelector('.KEpBR');
    const rightSidebarLocal = document.querySelector('.suFdL');
    if (!leftSidebar || !rightSidebarLocal) return;

    // Find chords container - look for the section with heading containing "Chords"
    let chordsSection = null;
    const rightSidebarSections = rightSidebarLocal.querySelectorAll('section, [class*="Sidebar"], div[class*="vDVhe"] > div');
    for (const section of rightSidebarSections) {
      const headingText = section.textContent || '';
      if (headingText.includes('Chords') || section.querySelector('svg[class*="chord"]') || section.querySelector('[class*="chord"]')) {
        chordsSection = section;
        break;
      }
    }
    if (!chordsSection) {
      chordsSection = rightSidebarLocal.querySelector('[data-name="chords"], .js-store, [class*="ChordDiagram"]')?.closest('section, div[class]');
    }
    if (chordsSection && !leftSidebar.contains(chordsSection)) {
      leftSidebar.insertBefore(chordsSection, leftSidebar.firstChild);
      // After moving, hide or remove the collapse/expand button inside chordsSection or its parent
      const collapseBtn = chordsSection.querySelector('button[aria-label*="ollapse"], button[aria-label*="Expand"], [class*="collapse"], [class*="expand"], [data-testid*="collapse"], [data-testid*="expand"]');
      if (collapseBtn) {
        // Option 1: Hide it
        collapseBtn.style.display = 'none';
        // Option 2: Remove it (uncomment if you prefer removal)
        // collapseBtn.remove();
        console.log('[UG Script] Hid collapse/expand button in chords section');
      }
      // Also check parent in case the button is outside
      const parentCollapseBtn = chordsSection.parentElement?.querySelector('button[aria-label*="ollapse"], button[aria-label*="Expand"], [class*="collapse"], [class*="expand"], [data-testid*="collapse"], [data-testid*="expand"]');
      if (parentCollapseBtn) {
        parentCollapseBtn.style.display = 'none';
        // parentCollapseBtn.remove();
        console.log('[UG Script] Hid collapse/expand button in chords parent');
      }
      console.log('[UG Script] Moved chords to left sidebar');
    }
  }

  function reorganizeLayout() {
    if (hasReorganized) return;


    // Wait for page to be ready
    const leftSidebar = document.querySelector('.KEpBR');
    const rightSidebar = document.querySelector('.suFdL');
    const navbar = document.querySelector('.M71za.IfVEB.IlvQM.bYTHw.yjpiY.ASYcf');
    const mainContainer = document.querySelector('.UNiKi');

    if (!leftSidebar || !rightSidebar || !navbar || !mainContainer) {
      setTimeout(reorganizeLayout, 100);
      return;
    }

    if (!leftSidebar || !rightSidebar || !navbar || !mainContainer) {
      setTimeout(reorganizeLayout, 100);
      return;
    }
    mainContainer.style.width = '100vw';
    mainContainer.style.boxSizing = 'border-box';
    // Remove any left/right auto margin
    if (mainContainer.style.marginLeft === 'auto' || mainContainer.style.marginRight === 'auto') {
      mainContainer.style.marginLeft = '0';
      mainContainer.style.marginRight = '0';
    }
    // Expand all direct grid children to fill available space and remove centering/width limits
    Array.from(mainContainer.children).forEach(child => {
      child.style.maxWidth = 'none';
      child.style.width = 'auto';
      child.style.margin = '0';
      child.style.boxSizing = 'border-box';
    });

    // Override the --ug-layout-center-column-width variable to prevent hardcoded max width
    mainContainer.style.setProperty('--ug-layout-center-column-width', '99.9vw');

    hasReorganized = true;
    console.log('[UG Script] Starting layout reorganization');

    // 1. Remove advertisement header (top banner)
    const adHeaders = document.querySelectorAll('[id^="ad_cs_"], bidding-wrapper, bidding-unit, .YJlyc, .vSVYa');
    adHeaders.forEach(ad => {
      console.log('[UG Script] Removing ad element:', ad.className || ad.id);
      ad.remove();
    });

    // 2. Move sign up & log in buttons to navbar
    const loginButtons = document.querySelector('.kb_IV');
    if (loginButtons && !navbar.querySelector('.kb_IV')) {
      console.log('[UG Script] Moving login buttons to navbar');
      navbar.appendChild(loginButtons);
    }

    // 3. Move chords section robustly using observer
    moveChordsToLeftSidebar();
    // Observe right sidebar for chords re-insertion
    const rightSidebarObs = document.querySelector('.suFdL');
    if (rightSidebarObs && !rightSidebarObs.__ugChordsObserver) {
      const observer = new MutationObserver(() => {
        moveChordsToLeftSidebar();
      });
      observer.observe(rightSidebarObs, { childList: true, subtree: true });
      rightSidebarObs.__ugChordsObserver = observer;
    }

    // 4. Hide the right sidebar to make main content use full width
    console.log('[UG Script] Hiding right sidebar');
    rightSidebar.style.display = 'none';

    // --- Chords font size controls in settings popup ---
    function patchSettingsPopup(settingsPopup) {
      if (!settingsPopup || settingsPopup.__ugChordsFontSizePatched) return;
      if (settingsPopup.querySelector('.ug-chords-fontsize-setting')) return;
      // Find the font size control to clone its style
      const fontSizeControl = Array.from(settingsPopup.querySelectorAll('div')).find(div => div.textContent && div.textContent.includes('Font size'));
      if (!fontSizeControl) return;
      // Create new control for chords font size
      const chordsFontDiv = document.createElement('div');
      chordsFontDiv.className = fontSizeControl.className + ' ug-chords-fontsize-setting';
      chordsFontDiv.style.marginTop = '8px';
      chordsFontDiv.innerHTML = `
        <div class="Q_TBK u4jSw aPN9d ru_9u cTzGe fiB3E p62dr iLhw7">Chords font size</div>
        <button type="button" tabindex="0" aria-label="Decrement Chords Font size" class="vs3kE vDzLP jcUeD Kb0iM cPCOm t8T86 ug-chords-fontsize-minus"><svg aria-hidden="true" viewBox="0 0 20 20" class="qkTwy"><path fill-rule="evenodd" d="M2 9h16v2H2z" clip-rule="evenodd"></path></svg></button>
        <div aria-hidden="true" class="Q_TBK PHusz aPN9d ru_9u cTzGe fiB3E p62dr d6UjI ug-chords-fontsize-value">0</div>
        <button type="button" tabindex="0" aria-label="Increment Chords Font size" class="vs3kE vDzLP jcUeD Kb0iM cPCOm t8T86 ug-chords-fontsize-plus"><svg aria-hidden="true" viewBox="0 0 20 20" class="qkTwy"><path d="M9 11v7h2v-7h7V9h-7V2H9v7H2v2z"></path></svg></button>
      `;
      fontSizeControl.parentElement.insertBefore(chordsFontDiv, fontSizeControl.nextSibling);
      // State management
      const LS_KEY = 'ug-chords-fontsize';
      const min = -3, max = 6, step = 1;
      function getFontSize() {
        return parseInt(localStorage.getItem(LS_KEY) || '0', 10);
      }
      function setFontSize(val) {
        localStorage.setItem(LS_KEY, val);
        updateFontSize(val);
      }
      function updateFontSize(val) {
        chordsFontDiv.querySelector('.ug-chords-fontsize-value').textContent = val;
        // Find chords container in left sidebar
        const leftSidebar = document.querySelector('.KEpBR');
        if (leftSidebar) {
          const chordsSection = Array.from(leftSidebar.querySelectorAll('section, [class*="Sidebar"], div[class*="vDVhe"] > div')).find(section => {
            const headingText = section.textContent || '';
            return headingText.includes('Chords') || section.querySelector('svg[class*="chord"]') || section.querySelector('[class*="chord"]');
          });
          if (chordsSection) {
            // Find all chord name spans (usually with class containing 'chord' or 'ChordDiagram')
            const chordSpans = chordsSection.querySelectorAll('span[class*="chord"], span[class*="ChordDiagram"], span[data-name*="chord"], span');
            chordSpans.forEach(span => {
              // Only increase font size for spans that look like chord names (not for all spans)
              if (/^[A-G][#bmaddsusdim0-9\/]*$/.test(span.textContent.trim())) {
                span.style.fontSize = val === 0 ? '' : `calc(1em + ${val * 0.15}em)`;
              }
            });
          }
        }
      }
      // Button handlers
      chordsFontDiv.querySelector('.ug-chords-fontsize-minus').onclick = () => {
        let val = getFontSize();
        if (val > min) setFontSize(val - step);
      };
      chordsFontDiv.querySelector('.ug-chords-fontsize-plus').onclick = () => {
        let val = getFontSize();
        if (val < max) setFontSize(val + step);
      };
      // Initial value
      updateFontSize(getFontSize());
      settingsPopup.__ugChordsFontSizePatched = true;
    }

    // Observe for settings popup being added
    let settingsPopupObserver = null;
    function observeSettingsPopup() {
      if (settingsPopupObserver) return;
      settingsPopupObserver = new MutationObserver(mutations => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1 && node.matches && node.matches('section[role="dialog"].BqVDk')) {
              patchSettingsPopup(node);
            }
          }
        }
      });
      settingsPopupObserver.observe(document.body, { childList: true, subtree: true });
    }
    observeSettingsPopup();

    // Listen for clicks on the settings button to trigger observer and patch if already present
    function setupSettingsButtonListener() {
      const settingsBtn = document.querySelector('button[aria-label="Settings"]');
      if (!settingsBtn || settingsBtn.__ugChordsFontSizeListener) return;
      settingsBtn.addEventListener('click', () => {
        setTimeout(() => {
          const popup = document.querySelector('section[role="dialog"].BqVDk');
          if (popup) patchSettingsPopup(popup);
        }, 100);
      });
      settingsBtn.__ugChordsFontSizeListener = true;
    }
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
  }).observe(document.querySelector('head > title'), {
    childList: true,
    subtree: true
  });
})();
