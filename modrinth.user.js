// ==UserScript==
// @name         Modrinth Wide Layout
// @author       Luuk Kablan
// @namespace    https://github.com/LuckyLuuk12/UserScripts
// @updateURL    https://raw.githubusercontent.com/LuckyLuuk12/UserScripts/main/modrinth.user.js
// @downloadURL  https://raw.githubusercontent.com/LuckyLuuk12/UserScripts/main/modrinth.user.js
// @source       https://github.com/LuckyLuuk12/UserScripts/blob/main/modrinth.user.js
// @homepageURL  https://github.com/LuckyLuuk12/UserScripts
// @version      1.0.0
// @description  Fix various styling issues on the Modrinth website, e.g. unset margin to use more space
// @match        https://modrinth.com/*
// @run-at       document-start
// @grant        GM_addStyle
// @license      MIT
// @copyright    2025, Luuk Kablan
// ==/UserScript==

(function() {
    'use strict';

    // Licensed under the MIT License (see LICENSE in repository root).
    // Original author: Luuk Kablan

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
