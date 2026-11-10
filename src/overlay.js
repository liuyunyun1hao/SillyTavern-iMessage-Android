// One registry for every surface that takes the tab bar away (modals, pickers, sheets, panels).
// A token belongs to the window that acquired it and only that window may release it, so nested
// overlays can never bring the bar back early. A theme stop clears the registry.

import { onStop } from './power.js';

/** @type {Set<string>} */
const tokens = new Set();
let seq = 0;

function apply() {
    document.body.classList.toggle('imsg-overlay', tokens.size > 0);
}

/** Registers an overlay and hides the tab bar; returns the token this window must release. */
export function acquire(kind = 'overlay') {
    const token = `${kind}#${++seq}`;
    tokens.add(token);
    apply();
    return token;
}

/** Releases this window's own token. Releasing twice (or someone else's) is a no-op. */
export function release(token) {
    if (token && tokens.delete(token)) {
        apply();
    }
}

export function reset() {
    tokens.clear();
    apply();
}

export function count() {
    return tokens.size;
}

onStop(reset);
