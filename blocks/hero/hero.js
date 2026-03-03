/**
 * Decorates the hero block.
 * - Sets hero image to eager loading (LCP)
 * - Identifies the eyebrow/tagline paragraph (first <p> before the <h1>)
 *   and marks it with a class for styling.
 * @param {Element} block The hero block element
 */
export default function decorate(block) {
  // Hero image is above the fold — load eagerly for LCP
  const img = block.querySelector('picture img');
  if (img) {
    img.loading = 'eager';
  } else {
    block.classList.add('no-image');
  }

  const h1 = block.querySelector('h1');
  if (!h1) return;

  // Find the first <p> that appears before the <h1> in the DOM and mark it as a tagline
  const contentDiv = h1.closest('div');
  if (!contentDiv) return;

  const children = [...contentDiv.children];
  const h1Index = children.indexOf(h1);

  for (let i = 0; i < h1Index; i += 1) {
    if (children[i].tagName === 'P' && !children[i].classList.contains('button-container')) {
      children[i].classList.add('hero-tagline');
      break;
    }
  }
}
