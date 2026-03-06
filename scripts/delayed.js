// Delayed functionality – martech, social share (injected on every page)
import {
  buildBlock, decorateBlock, loadBlock, loadScript,
} from './aem.js';
import { createTag } from './shared.js';

const SHARE_THIS_SRC = 'https://platform-api.sharethis.com/js/sharethis.js';
const KOFI_SCRIPT_SRC = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js';

async function injectSocialShareBlock() {
  const main = document.querySelector('main');
  if (!main || main.querySelector('.social-share')) return;

  const section = createTag('div', {
    class: 'section',
    'data-section-status': 'initialized',
  });
  section.style.display = null;

  const wrapper = createTag('div');
  const block = buildBlock('social-share', [[]]);
  wrapper.append(block);
  section.append(wrapper);

  const firstSection = main.querySelector(':scope > div.section');
  if (firstSection) {
    firstSection.insertAdjacentElement('afterend', section);
  } else {
    main.append(section);
  }

  decorateBlock(block);
  await loadBlock(block);
}

async function loadShareThis() {
  if (window.__shareThisLoaded) return;
  if (!document.querySelector('.sharethis-share-buttons')) return;

  await loadScript(SHARE_THIS_SRC, { async: '' });
  window.__shareThisLoaded = true;
}

function drawKoFiWidget() {
  if (window.__kofiWidgetDrawn) return;
  if (!window.kofiWidgetOverlay || typeof window.kofiWidgetOverlay.draw !== 'function') return;

  window.kofiWidgetOverlay.draw('diyfireca', {
    type: 'floating-chat',
    'floating-chat.donateButton.text': 'Support Us',
    'floating-chat.donateButton.background-color': '#323842',
    'floating-chat.donateButton.text-color': '#fff',
  });
  window.__kofiWidgetDrawn = true;
}

function loadKoFiWidget() {
  if (window.__kofiWidgetScheduled) return;
  window.__kofiWidgetScheduled = true;
  const existing = document.querySelector(`script[src="${KOFI_SCRIPT_SRC}"]`);
  if (existing) {
    drawKoFiWidget();
    return;
  }
  loadScript(KOFI_SCRIPT_SRC, { defer: '' }).then(drawKoFiWidget);
}

async function init() {
  await injectSocialShareBlock();
  await loadShareThis();
  loadKoFiWidget();
}

init();
