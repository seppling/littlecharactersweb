/**
 * Formatting for editable text. Everything is escaped; the only markup is:
 *   [link text](/page or https://…)   a link
 *   **words**                          bold
 *   *words*                            the spotlight in headlines (a class
 *                                      name the caller chooses), else italics
 * and {placeholders}, filled in from site settings before formatting.
 */
import { isSafeUrl } from './fields';

export type Vars = Record<string, string | number | undefined>;

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** "{email}" → the email address. Unknown names are left as typed, so a typo shows up on the page. */
export function fill(text: string, vars: Vars = {}) {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = vars[name];
    return v === undefined || v === '' ? whole : String(v);
  });
}

const MARKUP = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;

/** Editable text → safe HTML. */
export function rich(text: string | undefined, vars: Vars = {}, opts: { spotlight?: string } = {}): string {
  if (!text) return '';
  const source = fill(text, vars);
  let html = '';
  let last = 0;
  for (const m of source.matchAll(MARKUP)) {
    html += escapeHtml(source.slice(last, m.index));
    const [whole, label, href, bold, spot] = m;
    if (label !== undefined) {
      if (isSafeUrl(href) && !href.startsWith('{')) {
        const external = /^https?:/i.test(href);
        html += `<a href="${escapeHtml(href)}"${external ? ' rel="noopener"' : ''}>${escapeHtml(label)}</a>`;
      } else {
        html += escapeHtml(whole);
      }
    } else if (bold !== undefined) {
      html += `<strong>${escapeHtml(bold)}</strong>`;
    } else if (opts.spotlight) {
      html += `<span class="${escapeHtml(opts.spotlight)}">${escapeHtml(spot)}</span>`;
    } else {
      html += `<em>${escapeHtml(spot)}</em>`;
    }
    last = m.index + whole.length;
  }
  return html + escapeHtml(source.slice(last));
}

/** Editable text with its markup removed, for places that can't show links (page titles, emails). */
export function plain(text: string | undefined, vars: Vars = {}) {
  if (!text) return '';
  return fill(text, vars).replace(MARKUP, (_w, label, _href, bold, spot) => label ?? bold ?? spot);
}

/** A link from a URL field, with placeholders like {wishList} filled in. Unsafe results become '#'. */
export function href(url: string | undefined, vars: Vars = {}) {
  if (!url) return '#';
  const filled = fill(url, vars);
  return isSafeUrl(filled) && !filled.startsWith('{') ? filled : '#';
}
