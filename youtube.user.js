// ==UserScript==
// @name         YouTube Grid Layout - More Videos Per Row
// @author       Luuk Kablan
// @namespace    https://github.com/LuckyLuuk12/UserScripts
// @updateURL    https://raw.githubusercontent.com/LuckyLuuk12/UserScripts/main/youtube.user.js
// @downloadURL  https://raw.githubusercontent.com/LuckyLuuk12/UserScripts/main/youtube.user.js
// @source       https://github.com/LuckyLuuk12/UserScripts/blob/main/youtube.user.js
// @homepageURL  https://github.com/LuckyLuuk12/UserScripts
// @version      1.0.0
// @description  Modify YouTube's grid layout to show more videos per row (5 videos at 280px width on 1500px container)
// @match        https://www.youtube.com/*
// @match        https://www.youtube.com/watch*
// @icon         https://www.youtube.com/favicon.ico
// @run-at       document-start
// @grant        GM_addStyle
// @license      MIT
// @copyright    2026, Luuk Kablan
// ==/UserScript==

(function () {
  'use strict';

  // Licensed under the MIT License (see LICENSE in repository root).
  // Original author: Luuk Kablan

  // Override YouTube's CSS variables for rich grid layout
  // Target: 280px video width, 5 videos per row on 1500px container

  // Apply styles immediately
  GM_addStyle(`
        /* Override CSS variables on the grid container */
        #contents.ytd-rich-grid-renderer {
            --ytd-rich-grid-item-max-width: 280px !important;
            --ytd-rich-grid-item-min-width: 280px !important;
            --ytd-rich-grid-items-per-row: 5 !important;
            --ytd-rich-grid-item-margin: 16px !important;
            --ytd-rich-grid-posts-per-row: 5 !important;
            --ytd-rich-grid-slim-items-per-row: 5 !important;
        }

        /* Ensure the renderer respects the new grid settings */
        ytd-rich-grid-renderer {
            --ytd-rich-grid-gutter-margin: 16px !important;
            --ytd-rich-grid-content-max-width: calc(5 * (280px + 16px) - 16px) !important;
            --ytd-rich-grid-row-margin: 32px !important;
        }

        /* Force video items to be the correct width */
        ytd-rich-item-renderer {
            max-width: 280px !important;
            width: 280px !important;
        }

        /* Adjust the grid display */
        #contents.ytd-rich-grid-renderer {
            display: grid !important;
            grid-template-columns: repeat(auto-fill, 280px) !important;
            gap: 16px !important;
            justify-content: start !important;
        }

        /* ===== Watch Page Sidebar Modifications ===== */
        
        /* Make the sidebar container sticky and scrollable */
        ytd-watch-next-secondary-results-renderer {
            position: sticky !important;
            top: calc(var(--ytd-masthead-height, 56px) + 16px) !important;
            max-height: calc(100vh - var(--ytd-masthead-height, 56px) - 32px) !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
        }

        /* Make the recommendations container scrollable */
        #contents.ytd-item-section-renderer {
            max-height: calc(100vh - var(--ytd-masthead-height, 56px) - 32px) !important;
            overflow-y: auto !important;
        }

        /* Make video recommendations smaller */
        ytd-compact-video-renderer,
        yt-lockup-view-model {
            margin-bottom: 8px !important;
        }

        /* Reduce thumbnail size */
        ytd-compact-video-renderer ytd-thumbnail,
        yt-lockup-view-model ytd-thumbnail {
            max-width: 160px !important;
            min-width: 160px !important;
        }

        /* Reduce image container size for lockup view model - more specific selector */
        .yt-lockup-view-model--horizontal .yt-lockup-view-model__content-image,
        yt-lockup-view-model .yt-lockup-view-model__content-image,
        .yt-lockup-view-model__content-image {
            max-width: 200px !important;
            flex: none !important;
        }

        /* Force image elements inside to respect parent size */
        .yt-lockup-view-model__content-image img,
        .yt-lockup-view-model__content-image .ytCoreImageHost {
            max-width: 200px !important;
        }

        /* Adjust the overall width of sidebar items */
        ytd-watch-flexy[flexy] #secondary.ytd-watch-flexy {
            min-width: 400px !important;
        }

        /* Compact the video info next to thumbnails */
        ytd-compact-video-renderer #details,
        yt-lockup-view-model #content {
            padding-left: 8px !important;
        }

        /* Reduce spacing between videos */
        ytd-compact-video-renderer.ytd-item-section-renderer,
        ytd-compact-video-renderer.ytd-watch-next-secondary-results-renderer {
            margin-top: 0 !important;
            margin-bottom: 8px !important;
        }
    `);

  // Watch for YouTube's SPA navigation and reapply styles
  let lastUrl = location.href;

  function checkUrlChange() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Force style recalculation on navigation
      setTimeout(() => {
        const sidebarElements = document.querySelectorAll('.yt-lockup-view-model__content-image');
        sidebarElements.forEach(el => {
          el.style.maxWidth = '200px';
          el.style.flex = 'none';
        });
      }, 100);
    }
  }

  // Monitor for URL changes (YouTube SPA navigation)
  const observer = new MutationObserver(checkUrlChange);
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  // Also check on popstate (back/forward navigation)
  window.addEventListener('popstate', checkUrlChange);

  // Initial check after page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkUrlChange);
  } else {
    checkUrlChange();
  }

})();

