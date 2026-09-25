import { site } from '@/config/site';
import type { Program, Session } from '@/data/types';

/*
 * The single seam between the marketing site and the enrollment system.
 *
 * Phase 1: buttons hand off to Studio Director.
 * Phase 2: flip site.portal.mode to 'native' and the same buttons open our own
 * /enroll/<sessionId> flow, where a returning (remembered) family lands on a
 * pre-filled review step instead of a login wall.
 */

/** Partner-run registration (e.g. a school's own system) always goes to the partner. */
const isPartner = (url?: string) => !!url && !url.includes('docs.google.com');

export function enrollHref(program: Program, session: Session) {
  if (isPartner(session.externalUrl)) return session.externalUrl!;
  if (site.portal.mode === 'native') return `${site.portal.native.enroll}/${session.id}`;
  return session.externalUrl ?? site.portal.studioDirector.enroll;
}

export function enrollLabel(session: Session) {
  if (session.externalLabel && (isPartner(session.externalUrl) || site.portal.mode !== 'native')) return session.externalLabel;
  if (session.status === 'waitlist') return 'Join waitlist';
  if (session.status === 'coming-soon') return 'Get notified';
  return 'Enroll';
}

export function accountHref() {
  return site.portal.mode === 'native' ? site.portal.native.login : site.portal.studioDirector.login;
}

/** True when the link leaves our site (Studio Director or a partner). */
export function isExternal(href: string) {
  return /^https?:\/\//.test(href);
}
