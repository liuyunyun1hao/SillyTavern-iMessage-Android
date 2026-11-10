// The one back stack for the theme's phone navigation: the Contacts tab, its detail layer and the
// My Card sheet. Entries carry an id, so an async or repeated close can only consume the entry it
// actually owns; a programmatic close marks its entry and the matching popstate is swallowed.

/** @type {{id: string, kind: string, handler?: () => void}[]} */
const stack = [];
const closing = new Set();
let seq = 0;
let listening = false;

function onPop(event) {
    const top = stack.at(-1);
    if (!top) {
        return;
    }
    if (closing.has(top.id)) {
        // a close we started ourselves: drop the entry, do not run the back handler
        closing.delete(top.id);
        stack.pop();
        // a batch close (leaving the tab) keeps backing out until its lowest entry is gone
        if (stack.length && closing.has(stack.at(-1).id)) {
            history.back();
        }
        return;
    }
    stack.pop();
    top.handler?.();
}

function listen() {
    if (!listening) {
        window.addEventListener('popstate', onPop);
        listening = true;
    }
}

/** Pushes one layer; the handler runs when the user backs out of it. */
export function enter(kind, handler) {
    listen();
    const id = `${kind}#${++seq}`;
    stack.push({ id, kind, handler });
    history.pushState({ imsgEntry: id, imsgKind: kind }, '');
    return id;
}

/** Backs out of a layer (and anything opened on top of it) from code: tab tap, Done, Esc. */
export function exit(id) {
    const index = stack.findIndex((entry) => entry.id === id);
    if (index < 0) {
        return false;
    }
    for (let i = index; i < stack.length; i++) {
        closing.add(stack[i].id);
    }
    history.back();
    return true;
}

/** Whether a layer of this kind is open. */
export function has(kind) {
    return stack.some((entry) => entry.kind === kind);
}

export function reset() {
    stack.length = 0;
    closing.clear();
}
