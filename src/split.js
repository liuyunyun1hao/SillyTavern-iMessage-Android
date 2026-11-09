// Long replies display as several short bubbles split at sentence ends (shared/message-splitter.js).
// The chat still stores one message, so edit, swipe and regenerate are unaffected. A reply that
// wasn't streamed is revealed bubble by bubble with the typing dots in between.
// While a reply is being streamed, each finished sentence becomes its own bubble as it arrives.

import { events } from './power.js';
import { nearBottom } from './dom.js';
import { splitMessage } from './shared/message-splitter.js';

const BOX_CLASS = 'imsg-parts';
const PART_CLASS = 'imsg-part';
const TYPING_CLASS = 'imsg-part-typing';
/** How long the dots show before the next bubble: a base plus a little per character */
const REVEAL_BASE_MS = 450;
const REVEAL_PER_CHAR_MS = 30;
const REVEAL_MAX_MS = 2200;
/** Within this many pixels of the bottom, the chat follows a reply as it's revealed */
const FOLLOW_DISTANCE = 200;

/** Splitting state of each message element: the text it was split from, and a running reveal */
const state = new WeakMap();
/** Replies that just arrived whole, to bring in bubble by bubble */
const pendingReveal = new Set();
let streaming = false;
let generating = false;
let streamedThisTurn = false;
/** The message being streamed, with the parts shown so far */
let streamed = null;
let streamFrame = 0;

function isOn() {
    const body = document.body.classList;
    return body.contains('imessage') && body.contains('imsg-split-on');
}

function partsOf(text) {
    try {
        const parts = splitMessage(text);
        return Array.isArray(parts) ? parts.filter((part) => typeof part === 'string' && part.trim()) : [text];
    } catch (error) {
        console.warn('[iMessage] Could not split a message', error);
        return [text];
    }
}

function stopReveal(mes) {
    const entry = state.get(mes);
    if (entry?.timer) {
        clearTimeout(entry.timer);
        entry.timer = 0;
    }
    mes.classList.remove('imsg-revealing');
    mes.querySelector(`.${BOX_CLASS} > .${TYPING_CLASS}`)?.remove();
}

/** Puts the tail on the last bubble that's showing. */
function markTail(box) {
    const shown = [...box.children].filter((child) => !child.hidden);
    box.querySelectorAll(':scope > .imsg-tail').forEach((child) => child.classList.remove('imsg-tail'));
    shown.at(-1)?.classList.add('imsg-tail');
}

function unsplit(mes) {
    stopReveal(mes);
    mes.classList.remove('imsg-split');
    mes.querySelector(`.mes_block > .${BOX_CLASS}`)?.remove();
    state.delete(mes);
    if (streamed && document.querySelector('#chat > .mes.last_mes') === mes) {
        streamed = null;
    }
}

/** Shows one message as several bubbles, or as one when it's short or splitting is off. */
function renderSplit(mes) {
    const { chat, messageFormatting } = SillyTavern.getContext();
    const id = Number(mes.getAttribute('mesid'));
    const message = chat[id];
    const text = message?.mes;
    const splittable = isOn() && typeof text === 'string' && !message.is_user && !message.is_system
        && !mes.classList.contains('smallSysMes') && !(streaming && mes.classList.contains('last_mes'));
    if (!splittable) {
        if (state.has(mes)) {
            unsplit(mes);
        }
        return;
    }

    const key = `${message.swipe_id ?? 0}\u0000${text}`;
    if (state.get(mes)?.key === key) {
        return;
    }
    stopReveal(mes);

    const parts = partsOf(text);
    const textElement = mes.querySelector('.mes_block > .mes_text');
    if (parts.length < 2 || !textElement) {
        mes.classList.remove('imsg-split');
        mes.querySelector(`.mes_block > .${BOX_CLASS}`)?.remove();
        state.set(mes, { key, timer: 0 });
        return;
    }

    let box = mes.querySelector(`.mes_block > .${BOX_CLASS}`);
    if (!box) {
        box = document.createElement('div');
        box.className = BOX_CLASS;
        textElement.after(box);
    }
    box.replaceChildren(...parts.map((part) => {
        const bubble = document.createElement('div');
        bubble.className = PART_CLASS;
        bubble.innerHTML = messageFormatting(part, message.name, message.is_system, message.is_user, id);
        return bubble;
    }));
    markTail(box);
    mes.classList.add('imsg-split');
    state.set(mes, { key, timer: 0 });
}

/**
 * Splits the message being streamed: sentences already finished stay put, only the last (still
 * growing) one is redrawn. Called from a rAF, not on every token.
 */
function streamSplit(mes) {
    const { chat, messageFormatting } = SillyTavern.getContext();
    const id = Number(mes.getAttribute('mesid'));
    const message = chat[id];
    const text = message?.mes;
    if (!isOn() || typeof text !== 'string' || message.is_user || message.is_system
        || mes.classList.contains('smallSysMes')) {
        return;
    }

    const parts = partsOf(text);
    const textElement = mes.querySelector('.mes_block > .mes_text');
    if (!textElement) {
        return;
    }
    if (parts.length < 2) {
        mes.classList.remove('imsg-split');
        mes.querySelector(`.mes_block > .${BOX_CLASS}`)?.remove();
        streamed = null;
        return;
    }

    // nothing changed
    if (streamed?.id === id && streamed.parts.length === parts.length
        && streamed.parts.every((part, i) => part === parts[i])) {
        return;
    }

    let box = mes.querySelector(`.mes_block > .${BOX_CLASS}`);
    if (!box) {
        box = document.createElement('div');
        box.className = BOX_CLASS;
        textElement.after(box);
    }

    // keep the finished bubbles; redraw from the last one that changed
    const previous = streamed?.id === id ? streamed.parts : [];
    let common = 0;
    while (common < parts.length - 1 && common < previous.length && previous[common] === parts[common]) {
        common++;
    }
    const children = [...box.children];
    for (let i = children.length - 1; i >= common; i--) {
        children[i].remove();
    }
    for (let i = common; i < parts.length; i++) {
        const bubble = document.createElement('div');
        bubble.className = PART_CLASS;
        bubble.innerHTML = messageFormatting(parts[i], message.name, message.is_system, message.is_user, id);
        box.append(bubble);
    }
    markTail(box);
    mes.classList.add('imsg-split');
    streamed = { id, parts };
}

/** Brings a just-arrived reply in one bubble at a time. */
function reveal(mes) {
    const entry = state.get(mes);
    const box = mes.querySelector(`.mes_block > .${BOX_CLASS}`);
    const parts = box ? [...box.querySelectorAll(`:scope > .${PART_CLASS}`)] : [];
    if (!entry || parts.length < 2) {
        return;
    }
    const chatElement = document.getElementById('chat');
    const follow = !chatElement || nearBottom(chatElement, FOLLOW_DISTANCE);
    parts.slice(1).forEach((part) => { part.hidden = true; });
    const typing = document.createElement('div');
    typing.className = `${PART_CLASS} ${TYPING_CLASS}`;
    typing.setAttribute('aria-hidden', 'true');
    typing.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
    mes.classList.add('imsg-revealing');

    let index = 1;
    const scroll = () => {
        if (follow && chatElement) {
            chatElement.scrollTop = chatElement.scrollHeight;
        }
    };
    const step = () => {
        const next = parts[index];
        if (!next || !mes.isConnected) {
            stopReveal(mes);
            markTail(box);
            return;
        }
        box.append(typing);
        markTail(box);
        scroll();
        const wait = Math.min(REVEAL_MAX_MS, REVEAL_BASE_MS + next.textContent.length * REVEAL_PER_CHAR_MS);
        entry.timer = setTimeout(() => {
            typing.remove();
            next.hidden = false;
            index++;
            markTail(box);
            scroll();
            entry.timer = setTimeout(step, 250);
        }, wait);
    };
    markTail(box);
    step();
}

/** Splits (or rejoins) every message in the open chat; called from the messages pass. */
export function splitAll(rows) {
    for (const mes of rows) {
        renderSplit(mes);
        const id = Number(mes.getAttribute('mesid'));
        if (pendingReveal.has(id)) {
            pendingReveal.delete(id);
            if (mes.classList.contains('imsg-split')) {
                reveal(mes);
            }
        }
    }
}

/** Forgets every split, so the next pass redraws them (after the setting changes). */
export function resetSplits() {
    streamed = null;
    document.querySelectorAll('#chat > .mes').forEach((mes) => {
        if (state.has(mes)) {
            unsplit(mes);
        }
    });
}

export function initSplit() {
    const { eventTypes } = SillyTavern.getContext();
    const eventSource = events();
    eventSource.on(eventTypes.GENERATION_STARTED, (_type, _options, dryRun) => {
        if (!dryRun) {
            generating = true;
            streamedThisTurn = false;
        }
    });
    eventSource.on(eventTypes.STREAM_TOKEN_RECEIVED, () => {
        streaming = true;
        streamedThisTurn = true;
        if (streamFrame || !isOn()) {
            return;
        }
        streamFrame = requestAnimationFrame(() => {
            streamFrame = 0;
            const mes = document.querySelector('#chat > .mes.last_mes[mesid]');
            if (mes) {
                streamSplit(mes);
            }
        });
    });
    eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, (messageId) => {
        streaming = false;
        const mes = document.querySelector(`#chat > .mes[mesid="${Number(messageId)}"]`);
        if (mes && streamedThisTurn) {
            // 定格最后一段，并写入 state，随后 splitAll 不会再重画一次（避免闪一下）
            streamSplit(mes);
            const { chat } = SillyTavern.getContext();
            const message = chat[Number(messageId)];
            if (typeof message?.mes === 'string') {
                state.set(mes, { key: `${message.swipe_id ?? 0}\u0000${message.mes}`, timer: 0 });
            }
            streamed = null;
        }
        if (generating && !streamedThisTurn && isOn() && !document.body.classList.contains('imsg-c-noReveal')) {
            pendingReveal.add(Number(messageId));
        }
    });
    for (const type of [eventTypes.GENERATION_ENDED, eventTypes.GENERATION_STOPPED]) {
        eventSource.on(type, () => {
            streaming = false;
            generating = false;
            streamed = null;
        });
    }
    eventSource.on(eventTypes.CHAT_CHANGED, () => {
        streaming = false;
        generating = false;
        pendingReveal.clear();
        streamed = null;
    });
}