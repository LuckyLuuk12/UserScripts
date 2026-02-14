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

        /* Hide empty rich section containers */
        ytd-rich-section-renderer {
            display: none !important;
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

        /* Hide recommendation feedback survey */
        lockup-attachments-view-model,
        yt-slimline-survey-view-model {
            display: none !important;
        }

        /* Hide members-only videos (applied via JavaScript) */
        ytd-rich-item-renderer[data-members-only="true"] {
            display: none !important;
        }
    `);

    // Function to hide members-only videos
    function hideMembersOnlyVideos() {
        const videoCards = document.querySelectorAll('ytd-rich-item-renderer');
        let hiddenCount = 0;
        const hiddenVideos = [];

        videoCards.forEach(card => {
            // Check if this card has already been processed
            if (card.hasAttribute('data-members-only')) {
                return;
            }

            // Look for "Members only" badge text
            const badges = card.querySelectorAll('.yt-badge-shape__text');
            let isMembersOnly = false;

            badges.forEach(badge => {
                if (badge.textContent.trim() === 'Members only') {
                    isMembersOnly = true;
                }
            });

            // Mark the card so we don't process it again
            card.setAttribute('data-members-only', isMembersOnly ? 'true' : 'false');

            // Log details if it's a members-only video
            if (isMembersOnly) {
                hiddenCount++;

                // Extract title and URL
                const titleElement = card.querySelector('.yt-lockup-metadata-view-model__title, h3 a');
                const title = titleElement ? titleElement.textContent.trim() : 'Unknown Title';
                const url = titleElement ? 'https://www.youtube.com' + titleElement.getAttribute('href') : 'Unknown URL';

                hiddenVideos.push({ title, url });
            }
        });

        // Log summary if any videos were hidden
        if (hiddenCount > 0) {
            console.log(`[YouTube UserScript] Hidden ${hiddenCount} members-only video(s):`);
            hiddenVideos.forEach((video, index) => {
                console.log(`  ${index + 1}. "${video.title}" - ${video.url}`);
            });
        }
    }

    // Function to hide feedback popups
    function hideFeedbackPopups() {
        const popups = document.querySelectorAll('lockup-attachments-view-model:not([data-feedback-hidden]), yt-slimline-survey-view-model:not([data-feedback-hidden])');
        let hiddenCount = 0;

        popups.forEach(popup => {
            popup.setAttribute('data-feedback-hidden', 'true');
            hiddenCount++;
        });

        if (hiddenCount > 0) {
            console.log(`[YouTube UserScript] Hidden ${hiddenCount} feedback popup(s)`);
        }
    }

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

                // Hide members-only videos after navigation
                hideMembersOnlyVideos();
                // Hide feedback popups after navigation
                hideFeedbackPopups();
            }, 100);
        }
    }

    // Monitor for URL changes and new content (YouTube SPA navigation)
    const observer = new MutationObserver(() => {
        checkUrlChange();
        hideMembersOnlyVideos();
        hideFeedbackPopups();
    });
    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
    });

    // Also check on popstate (back/forward navigation)
    window.addEventListener('popstate', checkUrlChange);

    // Initial check after page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            checkUrlChange();
            hideMembersOnlyVideos();
            hideFeedbackPopups();
        });
    } else {
        checkUrlChange();
        hideMembersOnlyVideos();
        hideFeedbackPopups();
    }

})();

