import { events, isOn, onStart } from './power.js';
import { context, glyph, nearBottom, t, within } from './dom.js';

const TOOLTIP_ID = 'imsg-tooltip';
const TOOLTIP_DELAY_MS = 600;

export function decorate(mes, message) {
    const block = mes.querySelector(':scope > .mes_block');
    if (!block) return;
    if (message?.extra?.imsg_edited) {
        mes.dataset.imsgEdited = t('Edited 已编辑');
    } else {
        delete mes.dataset.imsgEdited;
    }
    const bar = mes.querySelector('.mes_buttons');
    if (bar) {
        let time = bar.querySelector(':scope > .imsg-bar-time');
        const date = message?.send_date ? context().timestampToMoment(message.send_date) : null;
        const label = date?.isValid() ? date.format('LT') : '';
        if (label && !time) {
            time = document.createElement('span');
            time.className = 'imsg-bar-time';
            bar.prepend(time);
        }
        if (time) time.textContent = label;
    }
}

function initTooltips() {
    let timer = 0;
    let target = null;
    const tip = document.createElement('div');
    tip.id = TOOLTIP_ID;
    tip.hidden = true;
    onStart(() => document.body.append(tip));
    const hide = () => {
        clearTimeout(timer);
        tip.hidden = true;
        if (target?.dataset.imsgTitle !== undefined) {
            target.setAttribute('title', target.dataset.imsgTitle);
            delete target.dataset.imsgTitle;
        }
        target = null;
    };
    document.addEventListener('pointerover', (event) => {
        if (!isOn() || event.pointerType === 'touch') return;
        const element = event.target.closest?.('[title]');
        if (!element || element === target || !element.getAttribute('title')?.trim() || element.matches('input, textarea, select')) return;
        hide();
        target = element;
        element.dataset.imsgTitle = element.getAttribute('title');
        element.removeAttribute('title');
        timer = setTimeout(() => {
            if (!target?.isConnected) return;
            tip.textContent = target.dataset.imsgTitle;
            tip.hidden = false;
            const box = target.getBoundingClientRect();
            tip.style.left = `${Math.max(6, Math.min(window.innerWidth - tip.offsetWidth - 6, box.left + box.width / 2 - tip.offsetWidth / 2))}px`;
            tip.style.top = `${box.bottom + 6}px`;
        }, TOOLTIP_DELAY_MS);
    });
    document.addEventListener('pointerout', (event) => {
        if (target && !target.contains(event.relatedTarget)) hide();
    });
}

/**
 * 输入框左侧的加号打开酒馆的「聊天选项」。
 * 酒馆自己用 document 上的「点到别处就收起」来管这个菜单，判断依据是按钮的 :hover / :focus；
 * 部分安卓浏览器（套壳 WebView、Via 之类）点完触摸不会留下 :hover，于是同一次点击里菜单刚
 * 打开就被收起，用户看到的就是「点了没反应」。这里让这次点击不再冒泡到 document，
 * 菜单就留得住；点空白处时酒馆自己的收起逻辑照常工作。
 */
function initComposerPlus() {
    const left = document.getElementById('leftSendForm');
    const button = document.getElementById('options_button');
    if (!left || !button) {
        return;
    }
    if (!left.dataset.imsgComposer) {
        left.dataset.imsgComposer = '1';
        left.addEventListener('click', (event) => {
            if (!isOn()) {
                return;
            }
            // 冒泡阶段：按钮自己的开关先跑过，再把这次点击挡在 document 之外
            event.stopPropagation();
        });
    }
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', t('Chat Options 聊天选项'));
    button.setAttribute('title', t('Chat Options 聊天选项'));
}

export function initFeatures() {
    const { eventTypes } = context();
    const eventSource = events();

    // 只负责点击气泡展开操作栏
    document.addEventListener('click', (event) => {
        if (!isOn()) return;
        if (event.target.closest('.mes_buttons') || event.target.closest('.mes_edit_buttons') || event.target.closest('.edit_textarea') || event.target.closest('textarea')) return;

        const block = event.target.closest?.('.mes_block');
        const mes = block ? block.closest('#chat > .mes') : null;

        document.querySelectorAll('#chat > .mes.imsg-bar-open').forEach(el => {
            if (el !== mes) el.classList.remove('imsg-bar-open');
        });
        
        if (mes && !mes.querySelector('.edit_textarea')) {
            mes.classList.toggle('imsg-bar-open');
        }
    });

    eventSource.on(eventTypes.MESSAGE_EDITED, async (messageId) => {
        const message = context().chat[Number(messageId)];
        if (!message || message.is_system) return;
        message.extra ??= {};
        message.extra.imsg_edited = true;
        await context().saveChat();
    });

    eventSource.on(eventTypes.CHAT_CHANGED, () => {
        setTimeout(() => {
            const chatElement = document.getElementById('chat');
            if (chatElement) {
                chatElement.scrollTop = chatElement.scrollHeight;
            }
        }, 150);
    });

    initTooltips();
    onStart(initComposerPlus);
}