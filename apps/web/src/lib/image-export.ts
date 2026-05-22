/**
 * Client-side PNG export helper — zero dependencies.
 *
 * Approach: serialize the target DOM/SVG to an inline SVG document,
 * render it onto a canvas via a data-URL image, then export via `canvas.toBlob`.
 *
 * Caveats:
 * - Browsers refuse to draw foreignObject SVGs containing external CSS without
 *   inlining the stylesheets. We inline computed styles for HTML branches and
 *   trust SVG branches to be self-contained (the schedule S-curve is).
 * - Cross-origin images inside the target element will taint the canvas; this
 *   helper accepts that limitation since the schedule charts use no <img>.
 */

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick so the browser has time to fire the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function svgToBlob(svgMarkup: string, width: number, height: number, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas 2d context unavailable')); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob returned null')), 'image/png');
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG image failed to load (likely tainted or malformed)'));
    };
    img.src = url;
  });
}

/**
 * Inline computed styles on every node in `root` so the standalone HTML clone
 * inside a foreignObject still renders identically without the page stylesheet.
 */
function inlineStyles(source: Element, clone: Element): void {
  const srcChildren = source.children;
  const clChildren = clone.children;
  const srcStyle = getComputedStyle(source);
  let cssText = '';
  // Only persist a curated set of properties — full computed style explodes the
  // SVG payload (10MB+) and slows the rasterization.
  const props = [
    'font', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
    'color', 'background', 'background-color', 'background-image',
    'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-color', 'border-width', 'border-style', 'border-radius',
    'padding', 'margin', 'width', 'height', 'min-width', 'min-height',
    'max-width', 'max-height', 'display', 'box-sizing', 'overflow',
    'text-align', 'text-decoration', 'letter-spacing', 'white-space',
    'position', 'top', 'right', 'bottom', 'left', 'z-index',
    'flex', 'flex-direction', 'justify-content', 'align-items', 'gap',
    'grid-template-columns', 'opacity',
  ];
  for (const p of props) {
    const v = srcStyle.getPropertyValue(p);
    if (v) cssText += `${p}:${v};`;
  }
  (clone as HTMLElement).setAttribute('style', cssText);
  for (let i = 0; i < srcChildren.length; i++) {
    const s = srcChildren[i];
    const c = clChildren[i];
    if (s && c) inlineStyles(s, c);
  }
}

/**
 * Export an HTML or SVG element as PNG. Triggers a browser download.
 */
export async function exportElementAsPng(element: HTMLElement | SVGElement, filename: string): Promise<void> {
  const rect = element.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  if (width === 0 || height === 0) throw new Error('Element has zero size');

  let svgMarkup: string;

  if (element instanceof SVGElement) {
    // Native SVG (e.g. the S-curve chart) — serialize directly.
    const clone = element.cloneNode(true) as SVGElement;
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!clone.getAttribute('width')) clone.setAttribute('width', String(width));
    if (!clone.getAttribute('height')) clone.setAttribute('height', String(height));
    svgMarkup = new XMLSerializer().serializeToString(clone);
  } else {
    // HTML branch — embed inside foreignObject with inlined computed styles.
    const clone = element.cloneNode(true) as HTMLElement;
    inlineStyles(element, clone);
    const html = new XMLSerializer().serializeToString(clone);
    svgMarkup =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<foreignObject x="0" y="0" width="100%" height="100%">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="background:#fff;width:${width}px;height:${height}px;">` +
      html +
      `</div></foreignObject></svg>`;
  }

  const blob = await svgToBlob(svgMarkup, width, height, 2);
  const safeName = filename.endsWith('.png') ? filename : `${filename}.png`;
  downloadBlob(blob, safeName);
}
