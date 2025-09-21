// ==UserScript==
// @name         GitHub Navbar Merge on Scroll
// @namespace    https://github.com/LuckyLuuk12/UserScripts
// @updateURL    https://raw.githubusercontent.com/LuckyLuuk12/UserScripts/main/github.user.js
// @downloadURL  https://raw.githubusercontent.com/LuckyLuuk12/UserScripts/main/github.user.js
// @source       https://github.com/LuckyLuuk12/UserScripts/blob/main/github.user.js
// @homepageURL  https://github.com/LuckyLuuk12/UserScripts
// @version      1.0.0
// @description  Merge top-right GitHub navbar items with bottom navbar on scroll
// @author       LuckyLuuk12
// @match        https://github.com/*
// @icon         https://github.com/favicon.ico
// @run-at       document-end
// @grant        none
// @license      MIT
// @copyright    2025, Luuk Kablan
// ==/UserScript==

(function() {
    'use strict';

    // Licensed under the MIT License (see LICENSE in repository root).
    // Original author: Luuk Kablan

    // Target selectors for GitHub's header parts
    const headerSelector = 'header.AppHeader';
    const globalBarSelector = '.AppHeader-globalBar';
    const localBarSelector = '.AppHeader-localBar';

    let headerEl = null;
    let globalBar = null;
    let localBar = null;
    let spacer = null; // keeps layout from jumping
    let fixed = false;
    let styleTag = null;
    let repositioned = []; // { el, originalStyle, childOriginalStyles, originalTop }
    const TOP_FIXED_PX = 8; // top offset for right-side controls when fixed
    const UNDERLINE_EXTRA_PX = 8; // extra gap between underline content and right-side controls
    let underlineSaved = []; // { el, originalStyle, originalPaddingRight, originalMarginRight }

    // Find the nearest ancestor that creates a containing block for fixed-position descendants
    function findTransformedAncestor(el) {
        try {
            let node = el.parentElement;
            while (node && node !== document.documentElement) {
                const cs = getComputedStyle(node);
                if (!cs) { node = node.parentElement; continue; }
                // properties that create a containing block for fixed descendants
                if ((cs.transform && cs.transform !== 'none') || (cs.perspective && cs.perspective !== 'none') || (cs.filter && cs.filter !== 'none') || (cs.willChange && /transform|perspective/.test(cs.willChange))) {
                    return node;
                }
                node = node.parentElement;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function computeCorrectedTopFor(el) {
        const anc = findTransformedAncestor(el);
        if (!anc) return TOP_FIXED_PX;
        try {
            const aRect = anc.getBoundingClientRect();
            // anc.getBoundingClientRect().top is the y-offset of the ancestor relative to viewport
            // when fixed is positioned relative to anc, we need top such that viewport top offset becomes TOP_FIXED_PX
            return TOP_FIXED_PX - Math.round(aRect.top);
        } catch (e) { return TOP_FIXED_PX; }
    }

    // Recompute and apply top for all repositioned elements (used on resize/scroll while fixed)
    function updatePositionedTops() {
        try {
            repositioned.forEach(entry => {
                try {
                    if (!entry || !entry.el) return;
                    // only adjust if currently fixed
                    const cs = getComputedStyle(entry.el);
                    if (cs && cs.position === 'fixed') {
                        const corrected = computeCorrectedTopFor(entry.el);
                        entry.el.style.top = corrected + 'px';
                    }
                } catch (e) { /* ignore per-entry failures */ }
            });
        } catch (e) { /* ignore */ }
    }

    // Ensure we have live references to the elements (GitHub is an SPA)
    function ensureElements() {
        headerEl = document.querySelector(headerSelector) || document.querySelector('header');
        if (!headerEl) return false;
        globalBar = headerEl.querySelector(globalBarSelector) || headerEl.querySelector('.AppHeader-globalBar');
        localBar = headerEl.querySelector(localBarSelector) || document.querySelector(localBarSelector) || headerEl.querySelector('.AppHeader-localBar');
        return !!localBar;
    }

    function createSpacer(height) {
        if (spacer) return;
        spacer = document.createElement('div');
        spacer.className = 'gus-localbar-spacer';
        spacer.style.width = '100%';
        spacer.style.height = height + 'px';
        // Insert spacer after header so content keeps same offset
        if (headerEl && headerEl.parentNode) headerEl.parentNode.insertBefore(spacer, headerEl.nextSibling);
    }

    // Create a small stylesheet to permanently remove padding-right from UnderlineNav actions
    function ensureUnderlineNavStyle() {
        if (styleTag) return;
        try {
            styleTag = document.createElement('style');
            styleTag.setAttribute('data-gus', 'underline-nav-fix');
            // Force 0 padding/margin by default so the underline nav is flush when not fixed.
            // The script will set an inline padding-right with !important when the header is fixed.
            styleTag.textContent = `
                /* Make UnderlineNav actions flush by default (we override with inline !important when fixed) */
                .UnderlineNav-actions{padding-right:0 !important;margin-right:0 !important;position:relative !important;} 
                /* Neutralize common pr-* utility classes that add padding (match any class containing 'pr-') */
                .UnderlineNav-actions[class*="pr-"]{padding-right:0 !important;} 
                /* If layout forces the actions to be position:absolute, make them behave as relative so inline spacing applies predictably */
                .UnderlineNav-actions.position-absolute{position:relative !important;}
                /* Some extensions (eg. Refined GitHub) toggle visibility via wrapper classes */
                .rgh-has-more-dropdown .UnderlineNav-actions{visibility:visible !important;}
                /* Ensure parent nav container also defaults to zero padding so we can apply spacing to it if needed */
                .UnderlineNav, .UnderlineNav-body, .js-repo-nav, .repo-nav { padding-right: 0 !important; }
            `;
            (document.head || document.documentElement).appendChild(styleTag);
        } catch (e) {
            styleTag = null;
        }
    }

    // Immediately patch any existing elements (useful before CSS loads)
    function removeUnderlineNavPaddingImmediate() {
        try {
            // Try to find the UnderlineNav target. Prefer the actions container, but fall back to nearby underline nav
            let els = Array.from(document.querySelectorAll('.UnderlineNav-actions'));
            if (els.length === 0) {
                const fallbackSelectors = ['.UnderlineNav', '.js-repo-nav', '.UnderlineNav-body', '.repo-nav'];
                fallbackSelectors.forEach(sel => {
                    try {
                        document.querySelectorAll(sel).forEach(node => {
                            if (!node) return;
                            // prefer finding a child .UnderlineNav-actions inside the node
                            const inner = node.querySelector && node.querySelector('.UnderlineNav-actions');
                            const target = inner || node;
                            if (target && !els.includes(target)) els.push(target);
                        });
                    } catch (e) { /* ignore */ }
                });
            }

            if (!els || els.length === 0) {
                console.log('[gus] removeUnderlineNavPaddingImmediate: no UnderlineNav target found');
                els = [];
            }

            els.forEach(el => {
                try {
                    // Determine containment: header vs local bar
                    const inHeader = el && el.closest && el.closest(headerSelector);
                    const inLocalBar = el && el.closest && el.closest(localBarSelector);
                    const insideRepositioned = repositioned.some(r => r && r.el && r.el.contains && r.el.contains(el));
                    // Safety: if the element lives inside the header but NOT inside the localBar, skip it.
                    // Also skip elements that are inside a repositioned root.
                    if ((inHeader && !inLocalBar) || insideRepositioned) {
                        console.log('[gus] removeUnderlineNavPaddingImmediate: skipping element inside header/repositioned root', el);
                        return;
                    }
                    // Debug info for the element we're about to patch
                    console.log('[gus] removeUnderlineNavPaddingImmediate: patching', el && el.tagName, el && el.className);
                    el.style.paddingRight = '0';
                    el.style.marginRight = '0';
                    // Ensure it's not absolutely positioned
                    try { el.style.position = 'relative'; } catch (e) { /* no-op */ }
                } catch (inner) { /* ignore per-el */ }
            });
        } catch (e) { /* no-op */ }
    }

    // Measure the right-side controls and set margin-right on UnderlineNav-actions
    function updateUnderlineSpacing() {
        try {
            // measure outermost repositioned element width
            let width = 0;
            repositioned.forEach(e => {
                try {
                    if (e && e.el && e.el.isConnected) {
                        const r = e.el.getBoundingClientRect();
                        if (r.width > width) width = r.width;
                    }
                    console.log('Repositioned element:', e.el, 'width:', width, 'isConnected:', e.el.isConnected);
                } catch (er) { /* ignore */ }
            });
            // Temporary override: use a fixed padding of 600px while testing, per user request
            const needed = 600; // px
            // Gather UnderlineNav targets: prefer .UnderlineNav-actions but fall back to other nav containers
            let nodeList = Array.from(document.querySelectorAll('.UnderlineNav-actions'));
            if (nodeList.length === 0) {
                const fallbackSelectors = ['.UnderlineNav', '.js-repo-nav', '.UnderlineNav-body', '.repo-nav'];
                fallbackSelectors.forEach(sel => {
                    try {
                        document.querySelectorAll(sel).forEach(node => {
                            if (!node) return;
                            const inner = node.querySelector && node.querySelector('.UnderlineNav-actions');
                            const target = inner || node;
                            if (target && !nodeList.includes(target)) nodeList.push(target);
                        });
                    } catch (e) { /* ignore */ }
                });
            }
            // Prefer visible targets; if none are visible, fall back to any gathered targets
            const visibleCandidates = nodeList.filter(n => {
                try {
                    const cs = getComputedStyle(n);
                    const r = n.getBoundingClientRect();
                    return cs && cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 0 && r.height > 0;
                } catch (e) { return false; }
            });
            const targets = visibleCandidates.length ? visibleCandidates : nodeList;

            // Apply to each gathered target, but skip anything that lives inside our header (unless it's in localBar)
            targets.forEach(el => {
                try {
                    console.log('[gus] updateUnderlineSpacing: candidate target', el, 'class:', el.className);
                    const inHeader = el && el.closest && el.closest(headerSelector);
                    const inLocalBar = el && el.closest && el.closest(localBarSelector);
                    const insideRepositioned = repositioned.some(r => r && r.el && r.el.contains && r.el.contains(el));
                    if ((inHeader && !inLocalBar) || insideRepositioned) {
                        console.log('[gus] updateUnderlineSpacing: skipping candidate inside header/repositioned root', el);
                        return;
                    }
                    if (!el) return;
                    // Choose where to apply padding (actions element or parent nav)
                    let applyTarget = el;
                    try {
                        const csEl = getComputedStyle(el);
                        if (csEl && (csEl.position === 'absolute' || csEl.visibility === 'hidden' || csEl.display === 'none')) {
                            const parentNav = el.closest('.UnderlineNav') || el.closest('.js-repo-nav') || el.closest('.UnderlineNav-body') || el.closest('.repo-nav') || el.parentElement;
                            if (parentNav) applyTarget = parentNav;
                        }
                    } catch (e) { /* ignore */ }

                    // Find or create a save record for applyTarget (so we can restore it later)
                    let rec = underlineSaved.find(s => s && s.el === applyTarget);
                    if (!rec) {
                        const orig = applyTarget.getAttribute('style') || '';
                        const origPad = applyTarget.style.paddingRight || '';
                        const origMargin = applyTarget.style.marginRight || '';
                        const origClassName = applyTarget.className || '';
                        rec = { el: applyTarget, originalStyle: orig, originalPaddingRight: origPad, originalMarginRight: origMargin, originalClassName: origClassName };
                        underlineSaved.push(rec);
                    }

                    // remove any pr-<number> classes that add padding so our spacing is not overridden
                    try {
                        const toRemoveA = Array.from(el.classList || []).filter(c => /^pr(?:-[a-z0-9]+)*-\d+$/i.test(c));
                        if (toRemoveA.length) el.classList.remove(...toRemoveA);
                        const toRemoveB = Array.from(applyTarget.classList || []).filter(c => /^pr(?:-[a-z0-9]+)*-\d+$/i.test(c));
                        if (toRemoveB.length) applyTarget.classList.remove(...toRemoveB);
                    } catch (remErr) { /* ignore */ }

                    // Compute current paddings and set a padding shorthand that overrides the right value
                    try {
                        const cs = getComputedStyle(applyTarget);
                        const pt = (cs && cs.paddingTop) || '0px';
                        const pb = (cs && cs.paddingBottom) || '0px';
                        const pl = (cs && cs.paddingLeft) || '0px';
                        const shorthand = `${pt} ${needed}px ${pb} ${pl}`;
                        try { applyTarget.style.setProperty('padding', shorthand, 'important'); }
                        catch (inner) { applyTarget.style.padding = shorthand; }
                        // Also set explicit padding-right and margin-right on both applyTarget and the actions element
                        try { applyTarget.style.setProperty('padding-right', needed + 'px', 'important'); } catch (e) { applyTarget.style.paddingRight = needed + 'px'; }
                        try { el.style.setProperty('padding-right', needed + 'px', 'important'); } catch (e) { el.style.paddingRight = needed + 'px'; }
                        try { applyTarget.style.setProperty('margin-right', needed + 'px', 'important'); } catch (e) { applyTarget.style.marginRight = needed + 'px'; }
                        try { el.style.setProperty('margin-right', needed + 'px', 'important'); } catch (e) { el.style.marginRight = needed + 'px'; }
                    } catch (err) {
                        // final fallback: setAttribute on applyTarget
                        try {
                            const base = rec.originalStyle && rec.originalStyle.length ? rec.originalStyle : '';
                            const newStyle = (base ? base + '; ' : '') + 'padding: ' + needed + 'px !important;';
                            applyTarget.setAttribute('style', newStyle);
                        } catch (e) { /* ignore */ }
                    }
                } catch (er) { /* ignore per-el */ }
            });
        } catch (e) { /* ignore */ }
    }

    function restoreUnderlineSpacing() {
        try {
            underlineSaved.forEach(s => {
                try {
                    if (!s || !s.el) return;
                    if (s.originalStyle && s.originalStyle.length) {
                        s.el.setAttribute('style', s.originalStyle);
                    } else {
                        // Restore padding-right and margin-right from backups. Use removeProperty when original was empty.
                        if (s.originalPaddingRight !== undefined) {
                            if (s.originalPaddingRight === '') s.el.style.removeProperty('padding-right');
                            else {
                                try { s.el.style.paddingRight = s.originalPaddingRight; } catch (se) { s.el.style.paddingRight = s.originalPaddingRight; }
                            }
                        }
                        if (s.originalMarginRight !== undefined) {
                            if (s.originalMarginRight === '') s.el.style.removeProperty('margin-right');
                            else s.el.style.marginRight = s.originalMarginRight;
                        }
                        // If neither backup had a value and no other inline style exists, remove the attribute
                        if ((s.originalPaddingRight === '' || s.originalPaddingRight === undefined) && (s.originalMarginRight === '' || s.originalMarginRight === undefined)) {
                            if (!s.el.getAttribute('style') || s.el.getAttribute('style').trim() === '') s.el.removeAttribute('style');
                        }
                    }
                    // Restore original className if we saved one
                    try {
                        if (s.originalClassName !== undefined && s.el) s.el.className = s.originalClassName;
                    } catch (ce) { /* ignore */ }
                } catch (er) { /* ignore */ }
            });
        } finally { underlineSaved = []; }
    }

    function removeSpacer() {
        if (!spacer) return;
        if (spacer.parentNode) spacer.parentNode.removeChild(spacer);
        spacer = null;
    }

    function applyFixedState() {
        if (!ensureElements()) return;
        if (!localBar) return;

        // compute header height to use as spacer
        const headerRect = headerEl.getBoundingClientRect();
        const headerHeight = headerRect.height || localBar.getBoundingClientRect().height;

        // collapse top/global bar visually (don't use display:none so children can be positioned)
        if (globalBar) {
            // save original inline style and specific property backups so restoreRepositions can revert
            const orig = globalBar.getAttribute('style') || '';
            // avoid duplicating an entry for the same element
            const already = repositioned.some(e => e && e.el === globalBar);
            if (!already) {
                const propBackup = {
                    height: globalBar.style.height || '',
                    minHeight: globalBar.style.minHeight || '',
                    overflow: globalBar.style.overflow || '',
                    padding: globalBar.style.padding || '',
                    visibility: globalBar.style.visibility || ''
                };
                repositioned.push({ el: globalBar, originalStyle: orig, childOriginalStyles: [], propBackup });
            }
            globalBar.style.height = '1px';
            globalBar.style.minHeight = '1px';
            globalBar.style.overflow = 'hidden';
            globalBar.style.padding = '0';
            globalBar.style.visibility = 'visible';
        }

        // fix the local bar to top
        localBar.style.position = 'fixed';
        localBar.style.top = '0';
        localBar.style.left = '0';
        localBar.style.right = '0';
        localBar.style.zIndex = '9998';
        // ensure it has a solid background so page content doesn't show through
        try {
            const headerStyle = headerEl ? getComputedStyle(headerEl) : null;
            const localStyle = getComputedStyle(localBar);
            const globalStyle = globalBar ? getComputedStyle(globalBar) : null;

            const isTransparent = (s) => !s || s === 'transparent' || s === 'rgba(0, 0, 0, 0)' || s === 'rgba(0,0,0,0)';

            // Prefer any non-transparent background color from local, then header, then global
            let bgToUse = '';
            if (localStyle && !isTransparent(localStyle.backgroundColor)) bgToUse = localStyle.backgroundColor;
            else if (headerStyle && !isTransparent(headerStyle.backgroundColor)) bgToUse = headerStyle.backgroundColor;
            else if (globalStyle && !isTransparent(globalStyle.backgroundColor)) bgToUse = globalStyle.backgroundColor;

            // If there's a background-image on the header or global bar, copy that instead
            if (!bgToUse) {
                if (headerStyle && headerStyle.backgroundImage && headerStyle.backgroundImage !== 'none') {
                    localBar.style.backgroundImage = headerStyle.backgroundImage;
                    localBar.style.backgroundSize = headerStyle.backgroundSize;
                    localBar.style.backgroundPosition = headerStyle.backgroundPosition;
                } else if (globalStyle && globalStyle.backgroundImage && globalStyle.backgroundImage !== 'none') {
                    localBar.style.backgroundImage = globalStyle.backgroundImage;
                    localBar.style.backgroundSize = globalStyle.backgroundSize;
                    localBar.style.backgroundPosition = globalStyle.backgroundPosition;
                }
            }

            // Final fallback based on color scheme
            if (!bgToUse && !localBar.style.backgroundImage) {
                const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                bgToUse = dark ? '#0b1117' : '#ffffff';
            }

            if (bgToUse) localBar.style.background = bgToUse;

            // Copy backdrop-filter if header uses it (gives blur/translucent look)
            if (headerStyle && headerStyle.backdropFilter && headerStyle.backdropFilter !== 'none') {
                localBar.style.backdropFilter = headerStyle.backdropFilter;
            } else if (globalStyle && globalStyle.backdropFilter && globalStyle.backdropFilter !== 'none') {
                localBar.style.backdropFilter = globalStyle.backdropFilter;
            }
        } catch (e) {
            localBar.style.background = '#0b0b0b';
        }
        localBar.style.boxShadow = '0 1px 0 rgba(0,0,0,0.08)';

        createSpacer(headerHeight);
        fixed = true;

        // Reposition the original top-right elements using CSS only (avoid reparenting)
        try { repositionTopRight(); } catch (e) { /* no-op */ }
        try { updateUnderlineSpacing(); } catch (e) { /* no-op */ }
    }

    function removeFixedState() {
        if (!localBar) return;
        // restore any repositioned elements before clearing localBar styles
        try { restoreRepositions(); } catch (e) { /* no-op */ }
        try { restoreUnderlineSpacing(); } catch (e) { /* no-op */ }
        localBar.style.position = '';
        localBar.style.top = '';
        localBar.style.left = '';
        localBar.style.right = '';
        localBar.style.zIndex = '';
        localBar.style.background = '';
        localBar.style.backgroundImage = '';
        localBar.style.backgroundSize = '';
        localBar.style.backgroundPosition = '';
        localBar.style.backdropFilter = '';
        localBar.style.boxShadow = '';
        removeSpacer();
        fixed = false;
    }

    // Reposition existing header right-side elements by setting inline styles only
    function repositionTopRight() {
        if (!ensureElements()) return;
        // selectors for the right-side groups
        const selectors = ['.AppHeader-globalBar-end', '.AppHeader-actions'];

        // helper to find existing saved entry for an element
        const findEntry = (el) => repositioned.find(e => e && e.el === el);

        // compute top position (localBar is fixed at top:0 after applyFixedState)
        const top = localBar ? (localBar.getBoundingClientRect().top) : 0;

        // keep track of roots we've already repositioned so children aren't repositioned again
        const processedRoots = [];
        selectors.forEach(sel => {
            const el = headerEl.querySelector(sel) || document.querySelector(sel);
            if (!el) return;
            // if this element is contained inside an already-processed root, skip it
            const insideProcessed = processedRoots.some(root => root && root.contains && root.contains(el));
            if (insideProcessed) return;

            // save original inline style and originalTop (avoid duplicating an existing entry)
            let entry = findEntry(el);
            if (!entry) {
                const original = el.getAttribute('style') || '';
                const originalTopInline = el.style.top || null;
                let originalTopComputed = null;
                try {
                    const cs = getComputedStyle(el);
                    if (cs && cs.top) originalTopComputed = cs.top;
                } catch (e) { /* ignore */ }
                // also backup margin/padding/transform so we can restore exact spacing
                const propBackup = {
                    marginTop: el.style.marginTop || '',
                    paddingTop: el.style.paddingTop || '',
                    transform: el.style.transform || ''
                };
                entry = { el, originalStyle: original, childOriginalStyles: [], originalTopInline, originalTopComputed, propBackup };
                repositioned.push(entry);
            }

            // mark this element as processed root so nested selectors won't be handled
            processedRoots.push(el);
            // make it fixed and position at the configured TOP_FIXED_PX
            el.style.position = 'fixed';
            el.style.top = TOP_FIXED_PX + 'px';
            el.style.left = '0';
            el.style.right = '0';
            el.style.zIndex = '9999';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.pointerEvents = 'auto';
            el.style.background = 'transparent';
            el.style.padding = '0 12px';
            // remove any top spacing so the element aligns to the desired top offset
            el.style.marginTop = '0';
            el.style.paddingTop = '0';
            el.style.transform = 'none';

            // if it contains the user menu, set that child to margin-left:auto
            const user = el.querySelector('.AppHeader-user');
            if (user) {
                // record child original style if not already saved
                const already = (entry.childOriginalStyles || []).some(c => c && c.el === user);
                if (!already) {
                    const childOrig = user.getAttribute('style') || '';
                    entry.childOriginalStyles.push({ el: user, style: childOrig });
                }
                user.style.marginLeft = 'auto';
            }
            // Also zero-out top spacing on immediate children if they have non-default top spacing
            try {
                Array.from(el.children).forEach(child => {
                    if (!child || child === user) return;
                    try {
                        const cs = getComputedStyle(child);
                        const needsReset = (cs && (cs.marginTop && cs.marginTop !== '0px')) || (cs && (cs.paddingTop && cs.paddingTop !== '0px')) || (cs && (cs.transform && cs.transform !== 'none'));
                        if (needsReset) {
                            const alreadyChild = (entry.childOriginalStyles || []).some(c => c && c.el === child);
                            if (!alreadyChild) {
                                const childOrig = child.getAttribute('style') || '';
                                entry.childOriginalStyles.push({ el: child, style: childOrig });
                            }
                            child.style.marginTop = '0';
                            child.style.paddingTop = '0';
                            child.style.transform = 'none';
                        }
                    } catch (e) { /* ignore child failures */ }
                });
            } catch (e) { /* ignore */ }
            // Debug: report that we've repositioned this root element
            try { console.log('[gus] repositionTopRight: repositioned', el, 'class:', el.className); } catch (e) { /* ignore */ }
        });
    }

    function restoreRepositions() {
        // restore saved inline styles
        try {
            repositioned.forEach(entry => {
                try {
                    if (entry.el) {
                        // Prefer restoring the exact original inline style if we saved one
                        if (entry.originalStyle && entry.originalStyle.length) {
                            entry.el.setAttribute('style', entry.originalStyle);
                        } else {
                            // If we saved specific property backups (for global bar collapse), restore those
                            const pb = entry.propBackup || {};
                            if (pb.height !== undefined) entry.el.style.height = pb.height;
                            if (pb.minHeight !== undefined) entry.el.style.minHeight = pb.minHeight;
                            if (pb.overflow !== undefined) entry.el.style.overflow = pb.overflow;
                            if (pb.padding !== undefined) entry.el.style.padding = pb.padding;
                            if (pb.visibility !== undefined) entry.el.style.visibility = pb.visibility;
                            // restore margin/padding/transform for repositioned elements if present
                            if (pb.marginTop !== undefined) entry.el.style.marginTop = pb.marginTop;
                            if (pb.paddingTop !== undefined) entry.el.style.paddingTop = pb.paddingTop;
                            if (pb.transform !== undefined) entry.el.style.transform = pb.transform;

                            // If we stored an original inline 'top' value, restore it; otherwise clear inline top
                            if (entry.originalTopInline !== null && entry.originalTopInline !== undefined) {
                                entry.el.style.top = entry.originalTopInline;
                            } else if (entry.originalTopComputed && entry.originalTopComputed !== 'auto') {
                                entry.el.style.top = entry.originalTopComputed;
                            } else {
                                entry.el.style.top = '';
                            }

                            // Clear positional/display styles we added during repositioning so the element recenters
                            // but don't clobber any properties we just restored from backups above.
                            if (pb.padding === undefined) entry.el.style.padding = '';
                            // Clear the layout/position properties we set when repositioning
                            entry.el.style.position = '';
                            entry.el.style.left = '';
                            entry.el.style.right = '';
                            entry.el.style.zIndex = '';
                            entry.el.style.display = '';
                            entry.el.style.alignItems = '';
                            entry.el.style.pointerEvents = '';
                            entry.el.style.background = '';
                        }
                    }
                    if (entry.childOriginalStyles && entry.childOriginalStyles.length) {
                        entry.childOriginalStyles.forEach(c => {
                            if (c.el) {
                                if (c.style && c.style.length) c.el.setAttribute('style', c.style);
                                else c.el.removeAttribute('style');
                            }
                        });
                    }
                } catch (e) { /* ignore individual failures */ }
            });
        } finally {
            repositioned = [];
        }
    }

    // Throttled scroll handler using requestAnimationFrame
    let scheduled = false;
    function onScroll() {
        if (!ensureElements()) return;
        const sc = window.scrollY || window.pageYOffset;
        if (sc > 0 && !fixed) applyFixedState();
        else if (sc === 0 && fixed) removeFixedState();
        scheduled = false;
    }

    window.addEventListener('scroll', () => {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(onScroll);
    }, { passive: true });

    // Initial run in case page is already scrolled
    try { ensureElements(); onScroll(); } catch (e) { /* no-op */ }

    // Ensure underline nav style and patch any existing elements now
    ensureUnderlineNavStyle();
    removeUnderlineNavPaddingImmediate();

    // GitHub is an SPA; watch for header changes and reapply state if necessary
    const mo = new MutationObserver(() => {
        const hadElements = !!(headerEl && localBar);
        ensureElements();
        if (fixed) applyFixedState();
        // reapply underline nav fixes
        ensureUnderlineNavStyle();
        removeUnderlineNavPaddingImmediate();
        // if header was removed/readded while fixed, reapply spacer
    });
    mo.observe(document.documentElement || document.body, { childList: true, subtree: true });

    // small cleanup when navigating away
    window.addEventListener('beforeunload', () => {
        mo.disconnect();
    });

    // recalc underline spacing on resize when fixed
    let resizeScheduled = false;
    window.addEventListener('resize', () => {
        if (!fixed) return;
        if (resizeScheduled) return;
        resizeScheduled = true;
        window.requestAnimationFrame(() => {
            try { updateUnderlineSpacing(); } catch (e) { /* no-op */ }
            resizeScheduled = false;
        });
    });
})();
