// ==UserScript==
// @name         Modrinth Wide Layout
// @author       Luuk Kablan
// @namespace    https://github.com/LuckyLuuk12/BrowserUserScripts
// @version      1.0.0
// @description  Fix various styling issues on the Modrinth website, e.g. unset margin to use more space
// @match        https://modrinth.com/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // 1. Override layout restrictions + style fixes
    GM_addStyle(`
        .new-page,
        .new-page .normal-page__content {
            max-width: 100% !important;
            width: 100% !important;
        }

        /* 2. Force gallery view into 3 columns */
        .project-list.display-mode--gallery {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }

        /* 3. Make sidebar slightly smaller (15rem) always */
        .new-page .normal-page__sidebar {
            min-width: 15rem !important;
            width: 15rem !important;
        }
    `);

    // 4. Remove Tailwind max-width class from headers
    function fixHeader() {
        document.querySelectorAll("header").forEach(h => {
            h.classList.remove("max-w-[1280px]");
        });
    }

    // 5. Remove ad containers
    function removeAds() {
        document.querySelectorAll(".ad-parent").forEach(el => el.remove());
    }

    function applyFixes() {
        fixHeader();
        removeAds();
    }

    document.addEventListener("DOMContentLoaded", applyFixes);

    const observer = new MutationObserver(applyFixes);
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
