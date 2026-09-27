#!/usr/bin/env node
/**
 * Pulls copy and images from the current Squarespace site into content/scraped/
 * so it can be reviewed and migrated into src/data/.
 *
 * Usage:
 *   npm run scrape                       # scrapes https://www.littlecharacters.org
 *   SITE=https://example.com npm run scrape
 *   SKIP_IMAGES=1 npm run scrape         # copy only
 *
 * Squarespace serves a structured JSON version of any page when you append
 * ?format=json, which gives us clean body HTML, collection items (events) and
 * image URLs without having to parse the rendered theme markup.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { parse } from 'node-html-parser';
import TurndownService from 'turndown';

const SITE = (process.env.SITE ?? 'https://www.littlecharacters.org').replace(/\/$/, '');
const OUT = path.resolve(process.env.OUT ?? 'content/scraped');
const SKIP_IMAGES = process.env.SKIP_IMAGES === '1';
const DELAY_MS = Number(process.env.DELAY_MS ?? 400);
const UA = 'Mozilla/5.0 (compatible; LittleCharactersMigration/1.0)';

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
turndown.remove(['script', 'style', 'noscript', 'iframe']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, as = 'text') {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  if (as === 'json') return res.json();
  if (as === 'buffer') return { buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') ?? '' };
  return res.text();
}

function slugFor(url) {
  const p = new URL(url).pathname.replace(/^\/|\/$/g, '');
  return p ? p.replace(/\//g, '__') : 'home';
}

const IMAGE_HOSTS = /(squarespace-cdn\.com|squarespace\.com|sqspcdn\.com)/;

/** Collects image references from a chunk of Squarespace HTML. */
function imagesFromHtml(html, pageUrl) {
  const root = parse(html ?? '');
  const found = [];
  for (const el of root.querySelectorAll('img, [data-image], [data-src]')) {
    const src =
      el.getAttribute('data-src') ||
      el.getAttribute('data-image') ||
      el.getAttribute('src') ||
      el.getAttribute('srcset')?.split(/[\s,]/)[0];
    if (!src || src.startsWith('data:')) continue;
    const abs = new URL(src, pageUrl).href;
    if (!IMAGE_HOSTS.test(abs) && !abs.startsWith(SITE)) continue;
    found.push({ src: abs.split('?')[0], alt: el.getAttribute('alt') ?? '', page: pageUrl });
  }
  return found;
}

/**
 * Squarespace 7.1 pages keep their content in rendered "sections" rather than
 * in the JSON view's mainContent, so for regular pages we read the HTML.
 */
async function renderedMain(url) {
  const root = parse(await get(url));
  const main = root.querySelector('main#page') ?? root.querySelector('main') ?? root.querySelector('body');
  if (!main) return '';
  for (const el of main.querySelectorAll('script, style, noscript, svg, form, .sqs-cart-dropzone')) el.remove();
  return main.innerHTML;
}

function toMarkdown(html) {
  if (!html) return '';
  // Squarespace wraps text in lots of layout divs; turndown flattens those well.
  return turndown.turndown(html).replace(/\n{3,}/g, '\n\n').trim();
}

function frontmatter(obj) {
  const lines = Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return `---\n${lines.join('\n')}\n---\n\n`;
}

async function sitemapUrls() {
  const xml = await get(`${SITE}/sitemap.xml`);
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

async function main() {
  await mkdir(path.join(OUT, 'pages'), { recursive: true });
  await mkdir(path.join(OUT, 'images'), { recursive: true });

  const urls = await sitemapUrls();
  console.log(`Found ${urls.length} URLs in sitemap`);

  const pages = [];
  const images = new Map();
  let site = null;

  for (const url of urls) {
    const slug = slugFor(url);
    try {
      const json = await get(`${url}${url.includes('?') ? '&' : '?'}format=json`, 'json');
      site ??= { website: json.website, websiteSettings: json.websiteSettings };

      const item = json.item;
      const collection = json.collection ?? {};
      let bodyHtml = item?.body ?? json.mainContent ?? '';
      if (!item && toMarkdown(bodyHtml).length < 200) bodyHtml = await renderedMain(url);
      const title = item?.title ?? collection.title ?? '';

      const meta = {
        title,
        url,
        type: item ? `item:${collection.typeName ?? ''}` : `page:${collection.typeName ?? ''}`,
        description: collection.seoData?.seoDescription ?? collection.description ?? item?.excerpt ?? '',
        startDate: item?.startDate ? new Date(item.startDate).toISOString() : undefined,
        endDate: item?.endDate ? new Date(item.endDate).toISOString() : undefined,
        location: item?.location
          ? [item.location.addressTitle, item.location.addressLine1, item.location.addressLine2].filter(Boolean).join(', ')
          : undefined,
        heroImage: item?.assetUrl ?? undefined,
      };

      await writeFile(path.join(OUT, 'pages', `${slug}.md`), frontmatter(meta) + toMarkdown(bodyHtml) + '\n');
      await writeFile(path.join(OUT, 'pages', `${slug}.json`), JSON.stringify(json, null, 2));

      // Collection pages (e.g. /events) list their items; keep them as data.
      for (const key of ['items', 'upcoming', 'past']) {
        if (Array.isArray(json[key]) && json[key].length) {
          const simplified = json[key].map((it) => ({
            title: it.title,
            url: new URL(it.fullUrl ?? '', SITE).href,
            startDate: it.startDate ? new Date(it.startDate).toISOString() : undefined,
            endDate: it.endDate ? new Date(it.endDate).toISOString() : undefined,
            location: it.location?.addressTitle,
            excerpt: toMarkdown(it.excerpt ?? ''),
            image: it.assetUrl,
          }));
          await writeFile(path.join(OUT, `${slug}.${key}.json`), JSON.stringify(simplified, null, 2));
          for (const it of json[key]) if (it.assetUrl) images.set(it.assetUrl, { src: it.assetUrl, alt: it.title, page: url });
        }
      }

      for (const img of imagesFromHtml(bodyHtml, url)) images.set(img.src, img);
      if (meta.heroImage) images.set(meta.heroImage, { src: meta.heroImage, alt: title, page: url });

      pages.push({ slug, ...meta });
      console.log(`  ✓ ${url}`);
    } catch (err) {
      // Fall back to the rendered HTML so we still capture copy.
      try {
        const html = await get(url);
        const root = parse(html);
        const main = root.querySelector('main') ?? root.querySelector('#page') ?? root.querySelector('body');
        await writeFile(
          path.join(OUT, 'pages', `${slug}.md`),
          frontmatter({ title: root.querySelector('title')?.text ?? '', url, type: 'html-fallback' }) + toMarkdown(main?.innerHTML) + '\n',
        );
        for (const img of imagesFromHtml(main?.innerHTML, url)) images.set(img.src, img);
        pages.push({ slug, url, type: 'html-fallback' });
        console.log(`  ~ ${url} (html fallback: ${err.message})`);
      } catch (err2) {
        console.warn(`  ✗ ${url}: ${err2.message}`);
      }
    }
    await sleep(DELAY_MS);
  }

  if (site?.website?.logoImageUrl) {
    const logo = new URL(site.website.logoImageUrl, SITE).href;
    images.set(logo, { src: logo, alt: 'Site logo', page: SITE });
  }

  const manifest = [];
  if (!SKIP_IMAGES) {
    console.log(`Downloading ${images.size} images`);
    for (const img of images.values()) {
      try {
        const { buf, type } = await get(`${img.src}?format=2500w`, 'buffer');
        const ext = type.includes('png') ? 'png' : type.includes('gif') ? 'gif' : type.includes('webp') ? 'webp' : 'jpg';
        const base = decodeURIComponent(path.basename(new URL(img.src).pathname)).replace(/\.[a-z0-9]+$/i, '');
        const name = `${base.replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60)}-${createHash('sha1').update(img.src).digest('hex').slice(0, 6)}.${ext}`;
        await writeFile(path.join(OUT, 'images', name), buf);
        manifest.push({ ...img, file: `images/${name}` });
        await sleep(DELAY_MS / 2);
      } catch (err) {
        manifest.push({ ...img, error: err.message });
      }
    }
  }

  await writeFile(path.join(OUT, 'site.json'), JSON.stringify(site, null, 2));
  await writeFile(path.join(OUT, 'pages.json'), JSON.stringify(pages, null, 2));
  await writeFile(path.join(OUT, 'images.json'), JSON.stringify(SKIP_IMAGES ? [...images.values()] : manifest, null, 2));
  console.log(`Done. ${pages.length} pages, ${images.size} images → ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
