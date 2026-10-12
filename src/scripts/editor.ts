/**
 * The content editor in the browser: lists (add, move, remove), live item
 * headings, photos (pick, upload, focus point) and a warning before leaving
 * with unsaved changes. The form itself posts normally; see
 * src/components/admin/FieldInput.astro for the markup this works with.
 */

import { shrink } from './photos';

const form = document.querySelector<HTMLFormElement>('form[data-editor]');

// ───────────── Unsaved changes ─────────────

let dirty = false;
const markDirty = () => {
  dirty = true;
  form?.classList.add('is-dirty');
};
form?.addEventListener('input', markDirty);
form?.addEventListener('change', markDirty);
form?.addEventListener('submit', (event) => {
  const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
  if (submitter?.dataset.confirm && !confirm(submitter.dataset.confirm)) {
    event.preventDefault();
    return;
  }
  dirty = false;
  // Keep the chosen action (the disabled button's value isn't sent).
  if (submitter?.name) {
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = submitter.name;
    hidden.value = submitter.value;
    form.append(hidden);
  }
  for (const b of form.querySelectorAll<HTMLButtonElement>('[data-actions] button')) b.disabled = true;
});
window.addEventListener('beforeunload', (event) => {
  if (dirty) event.preventDefault();
});

// After a failed save, move to the list of problems so it's read out.
document.querySelector<HTMLElement>('[data-autofocus]')?.focus();

// ───────────── Lists ─────────────

let counter = 0;
const newToken = () => `n${Date.now().toString(36)}${(counter++).toString(36)}`;

function listOf(el: Element) {
  return el.closest<HTMLElement>('[data-list]');
}
function itemsOf(list: HTMLElement) {
  return [...list.querySelector<HTMLElement>(':scope > [data-list-items]')!.children] as HTMLElement[];
}
function updateAddButton(list: HTMLElement) {
  const button = list.querySelector<HTMLButtonElement>(':scope > [data-add-item]');
  const max = Number(button?.dataset.max || 0);
  if (button) button.hidden = max > 0 && itemsOf(list).length >= max;
}

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;

  const add = target.closest<HTMLButtonElement>('[data-add-item]');
  if (add) {
    const list = listOf(add)!;
    const template = list.querySelector<HTMLTemplateElement>(':scope > template[data-list-template]')!;
    const html = template.innerHTML.replaceAll(list.dataset.token!, newToken());
    const items = list.querySelector<HTMLElement>(':scope > [data-list-items]')!;
    items.insertAdjacentHTML('beforeend', html);
    const item = items.lastElementChild as HTMLDetailsElement;
    item.open = true;
    item.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select')?.focus();
    updateAddButton(list);
    markDirty();
    return;
  }

  const move = target.closest<HTMLButtonElement>('[data-move]');
  if (move) {
    event.preventDefault(); // it sits in the <summary>: don't fold the item
    const item = move.closest<HTMLElement>('[data-item]')!;
    const sibling = move.dataset.move === 'up' ? item.previousElementSibling : item.nextElementSibling;
    if (sibling) {
      if (move.dataset.move === 'up') sibling.before(item);
      else sibling.after(item);
      move.focus();
      markDirty();
    }
    return;
  }

  const copy = target.closest<HTMLButtonElement>('[data-copy]');
  if (copy) {
    event.preventDefault();
    copyItem(copy.closest<HTMLElement>('[data-item]')!);
    return;
  }

  const remove = target.closest<HTMLButtonElement>('[data-remove]');
  if (remove) {
    event.preventDefault();
    const item = remove.closest<HTMLElement>('[data-item]')!;
    const label = item.dataset.itemLabel ?? 'item';
    const title = item.querySelector('[data-item-title]')?.textContent?.trim();
    if (!confirm(`Remove this ${label}${title ? ` (${title})` : ''}? Nothing changes on the site until you publish.`)) return;
    const list = listOf(item)!;
    item.remove();
    updateAddButton(list);
    markDirty();
  }
});

for (const list of document.querySelectorAll<HTMLElement>('[data-list]')) updateAddButton(list);

/**
 * Copy a list item (last term's session, to change its dates) right below it.
 * The copy is a new item: hidden ids are cleared so it gets its own.
 */
function copyItem(item: HTMLElement) {
  const list = listOf(item)!;
  const max = Number(list.querySelector<HTMLButtonElement>(':scope > [data-add-item]')?.dataset.max || 0);
  if (max > 0 && itemsOf(list).length >= max) return;
  const tokenInput = item.querySelector<HTMLInputElement>(':scope > input[type=hidden][name$="[]"]')!;
  const listPath = tokenInput.name.slice(0, -2);
  const old = tokenInput.value;
  const fresh = newToken();
  // Carry over what's on screen, not just what was loaded.
  for (const el of item.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')) {
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox' || el.type === 'radio') el.toggleAttribute('checked', el.checked);
      else el.setAttribute('value', el.value);
    } else if (el instanceof HTMLTextAreaElement) {
      el.textContent = el.value;
    } else {
      for (const o of el.options) o.toggleAttribute('selected', o.selected);
    }
  }
  const idPrefix = `f-${listPath.replace(/[^\w-]+/g, '-')}`;
  const html = item.outerHTML.replaceAll(`${listPath}.${old}.`, `${listPath}.${fresh}.`).replaceAll(`${idPrefix}-${old}-`, `${idPrefix}-${fresh}-`);
  item.insertAdjacentHTML('afterend', html);
  const clone = item.nextElementSibling as HTMLDetailsElement;
  const cloneToken = clone.querySelector<HTMLInputElement>(':scope > input[type=hidden][name$="[]"]')!;
  cloneToken.value = fresh;
  for (const hidden of clone.querySelectorAll<HTMLInputElement>('input[type=hidden][name$=".id"]')) hidden.value = '';
  const title = clone.querySelector('[data-item-title]');
  if (title) title.textContent = `${title.textContent?.trim()} (copy)`;
  clone.open = true;
  clone.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select')?.focus();
  updateAddButton(list);
  markDirty();
}

// Item headings follow what's typed.
document.addEventListener('input', (event) => {
  const item = (event.target as HTMLElement).closest<HTMLElement>('[data-item]');
  if (!item?.dataset.titleKeys) return;
  const token = item.querySelector<HTMLInputElement>(':scope > input[type=hidden][name$="[]"]');
  if (!token) return;
  const prefix = `${token.name.slice(0, -2)}.${token.value}.`;
  const parts = item.dataset.titleKeys.split(',').map((key) => {
    const inputs = [...item.querySelectorAll<HTMLInputElement>(`[name="${CSS.escape(prefix + key)}"]`)];
    if (inputs[0]?.type === 'checkbox') return inputs.filter((i) => i.checked).map((i) => i.value).join(', ');
    const value = inputs[0]?.value?.trim() ?? '';
    // "16:30" → "4:30 pm", like the headings the page loads with.
    const time = value.match(/^(\d{2}):(\d{2})$/);
    if (time) return `${Number(time[1]) % 12 || 12}${time[2] === '00' ? '' : `:${time[2]}`} ${Number(time[1]) < 12 ? 'am' : 'pm'}`;
    return value;
  });
  const title = item.querySelector('[data-item-title]');
  if (title) title.textContent = parts.filter(Boolean).join(' · ') || `New ${item.dataset.itemLabel ?? 'item'}`;
});

// ───────────── Photos ─────────────

interface Photo {
  src: string;
  thumb?: string;
  alt: string;
  name: string;
}

const picker = document.querySelector<HTMLDialogElement>('dialog[data-photo-picker]');
let pickingFor: HTMLElement | null = null;
let library: Promise<Photo[]> | undefined;

function loadLibrary(refresh = false) {
  if (refresh || !library) {
    library = fetch('/api/admin/media', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { photos: [] }))
      .then((d) => d.photos as Photo[]);
  }
  return library;
}

async function showLibrary() {
  if (!picker) return;
  const grid = picker.querySelector<HTMLElement>('[data-picker-grid]')!;
  grid.replaceChildren(Object.assign(document.createElement('p'), { textContent: 'Loading photos…' }));
  const photos = await loadLibrary();
  grid.replaceChildren(
    ...photos.map((photo) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'picker__photo';
      button.dataset.src = photo.src;
      button.dataset.alt = photo.alt;
      button.dataset.thumb = photo.thumb ?? '';
      button.title = photo.name;
      const img = document.createElement('img');
      img.src = photo.thumb ?? '';
      img.alt = photo.alt || photo.name;
      img.loading = 'lazy';
      const caption = document.createElement('span');
      caption.textContent = photo.name;
      button.append(img, caption);
      return button;
    }),
  );
}

function setPhoto(field: HTMLElement, photo: { src: string; thumb: string; alt?: string }) {
  field.querySelector<HTMLInputElement>('[data-image-src]')!.value = photo.src;
  field.querySelector<HTMLInputElement>('[data-image-position]')!.value = '';
  const preview = field.querySelector<HTMLElement>('[data-focus-picker]')!;
  preview.querySelector('.img-field__empty')?.remove();
  let img = preview.querySelector<HTMLImageElement>('[data-image-thumb]');
  if (!img) {
    img = document.createElement('img');
    img.alt = '';
    img.dataset.imageThumb = '';
    preview.prepend(img);
  }
  img.src = photo.thumb;
  img.style.objectPosition = '50% 50%';
  const dot = preview.querySelector<HTMLElement>('[data-focus-dot]')!;
  dot.hidden = false;
  dot.style.left = '50%';
  dot.style.top = '50%';
  field.querySelector<HTMLElement>('[data-focus-help]')!.hidden = false;
  field.querySelector<HTMLButtonElement>('[data-remove-photo]')!.hidden = false;
  field.querySelector<HTMLButtonElement>('[data-choose-photo]')!.textContent = 'Change photo';
  const alt = field.querySelector<HTMLInputElement>('input[name$=".alt"]')!;
  if (!alt.value.trim() && photo.alt) alt.value = photo.alt;
  markDirty();
  if (!alt.value.trim()) alt.focus();
}

document.addEventListener('click', async (event) => {
  const target = event.target as HTMLElement;
  const field = target.closest<HTMLElement>('[data-image-field]');

  if (field && target.closest('[data-choose-photo]')) {
    pickingFor = field;
    picker?.showModal();
    await showLibrary();
    return;
  }

  if (field && target.closest('[data-remove-photo]')) {
    field.querySelector<HTMLInputElement>('[data-image-src]')!.value = '';
    field.querySelector<HTMLInputElement>('[data-image-position]')!.value = '';
    field.querySelector('[data-image-thumb]')?.remove();
    const preview = field.querySelector<HTMLElement>('[data-focus-picker]')!;
    if (!preview.querySelector('.img-field__empty')) {
      preview.prepend(Object.assign(document.createElement('span'), { className: 'img-field__empty', textContent: 'No photo' }));
    }
    field.querySelector<HTMLElement>('[data-focus-dot]')!.hidden = true;
    field.querySelector<HTMLElement>('[data-focus-help]')!.hidden = true;
    (target.closest('[data-remove-photo]') as HTMLElement).hidden = true;
    field.querySelector<HTMLButtonElement>('[data-choose-photo]')!.textContent = 'Choose photo';
    markDirty();
    return;
  }

  // The focus point: where the photo stays centered when it's cropped.
  const preview = target.closest<HTMLElement>('[data-focus-picker]');
  if (field && preview) {
    const img = preview.querySelector<HTMLImageElement>('[data-image-thumb]');
    if (!img) {
      pickingFor = field;
      picker?.showModal();
      await showLibrary();
      return;
    }
    const box = preview.getBoundingClientRect();
    const mouse = event as MouseEvent;
    // Keyboard "clicks" have no position: keep the current point.
    if (mouse.detail === 0) return;
    const x = Math.round(Math.min(100, Math.max(0, ((mouse.clientX - box.left) / box.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((mouse.clientY - box.top) / box.height) * 100)));
    field.querySelector<HTMLInputElement>('[data-image-position]')!.value = `${x}% ${y}%`;
    img.style.objectPosition = `${x}% ${y}%`;
    const dot = preview.querySelector<HTMLElement>('[data-focus-dot]')!;
    dot.style.left = `${x}%`;
    dot.style.top = `${y}%`;
    markDirty();
    return;
  }

  // In the picker: choose a photo.
  const choice = target.closest<HTMLButtonElement>('.picker__photo');
  if (choice && pickingFor) {
    setPhoto(pickingFor, { src: choice.dataset.src!, thumb: choice.dataset.thumb!, alt: choice.dataset.alt });
    picker?.close();
    return;
  }

  if (target.closest('[data-picker-close]')) picker?.close();
});

const upload = picker?.querySelector<HTMLInputElement>('[data-picker-upload]');
upload?.addEventListener('change', async () => {
  const file = upload.files?.[0];
  if (!file || !picker) return;
  const status = picker.querySelector<HTMLElement>('[data-picker-status]')!;
  status.textContent = 'Uploading…';
  status.classList.remove('is-error');
  try {
    const body = new FormData();
    body.append('file', await shrink(file), file.name.replace(/\.\w+$/, '') + '.jpg');
    const res = await fetch('/api/admin/media', { method: 'POST', body, credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'That upload didn’t work. Try again, or try a different photo.');
    status.textContent = 'Uploaded.';
    await loadLibrary(true);
    if (pickingFor) {
      setPhoto(pickingFor, { src: data.src, thumb: data.thumb });
      picker.close();
    } else {
      await showLibrary();
    }
  } catch (e) {
    status.textContent = (e as Error).message;
    status.classList.add('is-error');
  } finally {
    upload.value = '';
  }
});

picker?.addEventListener('close', () => {
  pickingFor = null;
  const status = picker.querySelector<HTMLElement>('[data-picker-status]');
  if (status) status.textContent = '';
});
