/** "Can my child try a class first?" → "can-my-child-try-a-class-first" */
export function slugify(text: string, max = 60) {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'‘]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= max) return slug;
  const cut = slug.slice(0, max);
  return cut.includes('-') ? cut.slice(0, cut.lastIndexOf('-')) : cut;
}

/** A short random id, like "k3f9x2ma". */
export function shortId(length = 8) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
