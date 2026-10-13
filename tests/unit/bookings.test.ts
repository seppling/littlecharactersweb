/**
 * One booking path, nothing past on the home page, and class pages and
 * confirmations that fit the kind of program (customer journey audit, notes 3, 4, 8).
 */
import { describe, expect, it } from 'vitest';
import { eventAction, eventSession } from '@/lib/events';
import { liveCallSheet, linkIsCurrent } from '@/lib/call-sheet';
import { arrivalLines, faqsFor, highlightsHeading, kindTag, moneyLines, oneOffPolicies, oneOffWhen, programFit } from '@/lib/program-fit';
import { canBook, type BookingClock } from '@/lib/session-dates';
import { events } from '@/content/seed/events';
import { faqs } from '@/content/seed/faqs';
import { pages } from '@/content/seed/pages';
import { programs } from '@/content/seed/programs';
import type { EventItem, Program } from '@/content/types';

const programBySlug = (slug: string) => programs.find((p) => p.slug === slug);
const program = (slug: string) => programBySlug(slug)!;
const event = (slug: string) => events.find((e) => e.slug === slug)!;
const clockAt = (now: string): BookingClock => ({ now, lateJoinWeeks: 4 });
const OCT_13 = clockAt('2026-10-13T09:00');

describe('one booking path for nights that are also class dates', () => {
  it('links each Parents’ Night Out, improv night and free class to its class session on the same date', () => {
    expect(eventSession(event('parents-night-out-oct'), programBySlug)?.session.id).toBe('pno-2026-10-24');
    expect(eventSession(event('improv-night-nov'), programBySlug)?.session.id).toBe('adult-improv-2026-11');
    expect(eventSession(event('free-class-nov'), programBySlug)?.session.id).toBe('free-class-2026-11-02');
    // Every dated night with a class page has its session: none falls back to its own link.
    for (const e of events.filter((x) => x.programSlug && x.times.length === 1)) {
      expect(eventSession(e, programBySlug), e.slug).toBeDefined();
    }
  });

  it('opens the site’s own sign-up for that date, never a Google Form', () => {
    expect(eventAction(event('parents-night-out-oct'), programBySlug, OCT_13)).toEqual({ label: 'Register', href: '/enroll/pno-2026-10-24' });
    expect(eventAction(event('improv-night-oct'), programBySlug, OCT_13)).toEqual({ label: 'Register', href: '/enroll/adult-improv-2026-10' });
    expect(eventAction(event('free-class-oct'), programBySlug, OCT_13)).toEqual({ label: 'Register', href: '/enroll/free-class-2026-10-15' });
    const everyLink = [...events.map((e) => e.cta?.href), ...programs.flatMap((p) => p.sessions.map((s) => s.externalUrl))];
    expect(everyLink.filter((h) => h?.includes('docs.google.com'))).toEqual([]);
  });

  it('follows the date’s status: waitlist, coming soon, closed, or started', () => {
    const pno = program('parents-night-out');
    const withStatus = (status: Program['sessions'][number]['status']) => {
      const p = { ...pno, sessions: pno.sessions.map((s) => (s.id === 'pno-2026-10-24' ? { ...s, status } : s)) };
      return eventAction(event('parents-night-out-oct'), (slug) => (slug === p.slug ? p : programBySlug(slug)), OCT_13);
    };
    expect(withStatus('waitlist')).toEqual({ label: 'Join waitlist', href: '/enroll/pno-2026-10-24' });
    expect(withStatus('coming-soon')).toEqual({ label: 'Get notified', href: '/programs/parents-night-out#notify' });
    expect(withStatus('closed')).toBeUndefined();
    // 5:30 pm on the night: sign-ups closed when it started, and no other way to book.
    expect(eventAction(event('parents-night-out-oct'), programBySlug, clockAt('2026-10-24T17:30'))).toBeUndefined();
  });

  it('keeps an event’s own button when it has no class date that day', () => {
    const show = event('jack-and-the-beanstalk');
    expect(eventAction(show, programBySlug, OCT_13)).toBe(show.cta);
    const moved: EventItem = { ...event('parents-night-out-oct'), times: [{ start: '2026-10-31T17:00', end: '2026-10-31T20:00' }] };
    expect(eventSession(moved, programBySlug)).toBeUndefined();
    expect(eventAction(moved, programBySlug, OCT_13)).toEqual({ label: 'Details', href: '/programs/parents-night-out' });
  });
});

describe('the home page’s call sheet', () => {
  const ctx = (today: string) => ({ today, events, programBySlug, clock: clockAt(`${today}T09:00`) });
  const titles = (today: string) => liveCallSheet(pages.home.callSheet.items, ctx(today)).map((i) => i.title);

  it('shows only what hasn’t happened yet', () => {
    expect(titles('2026-10-13')).toEqual([
      'Registration is open for all classes',
      'Free Community Theater Class',
      'Stories and Songs & Acting Studio',
      'Fall 2026 Variety Show',
    ]);
    // After Oct 20 the "starts Oct 20" card is down; after the Nov 2 free class, that one too.
    expect(titles('2026-10-21')).not.toContain('Stories and Songs & Acting Studio');
    expect(titles('2026-11-03')).toEqual(['Registration is open for all classes', 'Fall 2026 Variety Show']);
    expect(titles('2026-11-20')).toEqual(['Fall 2026 Variety Show']);
  });

  it('drops a card about an event that’s over, or that doesn’t exist', () => {
    const old = { when: 'Sun, Sep 27 · 1:30 pm', title: 'Jack and the Beanstalk', href: '/events#jack-and-the-beanstalk' };
    expect(liveCallSheet([old], ctx('2026-10-13'))).toEqual([]);
    expect(liveCallSheet([old], ctx('2026-09-27'))).toHaveLength(1);
    expect(linkIsCurrent('/events/no-such-show', ctx('2026-10-13'))).toBe(false);
    expect(linkIsCurrent('/programs/no-such-class', ctx('2026-10-13'))).toBe(false);
  });

  it('only links to pages that exist', () => {
    for (const item of pages.home.callSheet.items) {
      expect(linkIsCurrent(item.href, ctx('2026-10-13')), item.href).toBe(true);
      const path = item.href!.split(/[?#]/)[0];
      const slug = path.split('/')[2];
      if (path.startsWith('/programs/')) expect(programBySlug(slug), path).toBeDefined();
      if (path.startsWith('/events/')) expect(events.some((e) => e.slug === slug && e.kind === 'show'), path).toBe(true);
    }
  });
});

describe('the free community class', () => {
  it('is open for sign-ups now', () => {
    const free = program('free-community-class');
    expect(free.sessions.map((s) => s.status)).toEqual(['open', 'open']);
    expect(free.sessions.every((s) => canBook(free, s, OCT_13))).toBe(true);
  });
});

describe('class pages that fit the program', () => {
  it('knows how each program is booked', () => {
    const fits = Object.fromEntries(programs.map((p) => [p.slug, programFit(p)]));
    expect(fits).toMatchObject({
      'intro-to-theater': 'weekly',
      'stories-and-songs': 'weekly',
      'athens-academy-enrichment': 'school',
      'free-community-class': 'free',
      'parents-night-out': 'night',
      'geode-adult-improv': 'drop-in',
      parties: 'party',
      'private-lessons': 'lesson',
      ovation: 'adaptive',
      'summer-camp': 'camp',
    });
  });

  it('tags the improv night with its real rhythm, not “Weekly class”', () => {
    expect(kindTag(program('geode-adult-improv'))).toBe('Monthly drop-in');
    expect(kindTag(program('intro-to-theater'))).toBe('Weekly class');
    const twoInOneMonth = { ...program('geode-adult-improv'), sessions: program('geode-adult-improv').sessions.map((s) => ({ ...s, startDate: '2026-10-15', endDate: '2026-10-15' })) };
    expect(kindTag(twoInOneMonth)).toBe('Drop-in');
  });

  it('shows each pricing line only where it applies', () => {
    expect(moneyLines(program('intro-to-theater'))).toEqual(['trial', 'monthly', 'fee', 'multi', 'pay-what-you-can']);
    // A free first class on Stories and Songs too (decided Oct 13, 2026).
    expect(moneyLines(program('stories-and-songs'))).toEqual(['trial', 'fee', 'multi', 'pay-what-you-can']);
    expect(moneyLines(program('free-community-class'))).toEqual(['free']);
    expect(moneyLines(program('athens-academy-enrichment'))).toEqual(['school']);
    expect(moneyLines(program('geode-adult-improv'))).toEqual(['per-night']);
    expect(moneyLines(program('parents-night-out'))).toEqual(['per-child']);
    expect(moneyLines(program('parties'))).toEqual([]);
    expect(moneyLines(program('private-lessons'))).toEqual([]);
  });

  it('chooses FAQs by type: no tuition or unenrolling where there’s no tuition', () => {
    const qs = (slug: string) => faqsFor(program(slug), faqs).map((f) => f.q);
    for (const slug of ['free-community-class', 'geode-adult-improv', 'athens-academy-enrichment', 'parents-night-out', 'parties']) {
      expect(qs(slug).join(' '), slug).not.toMatch(/tuition|unenroll|cost/i);
      expect(qs(slug).length, slug).toBeGreaterThan(0);
    }
    expect(qs('intro-to-theater')).toContain('When is tuition due?');
    expect(qs('geode-adult-improv').join(' ')).not.toMatch(/child/i);
    expect(qs('athens-academy-enrichment').join(' ')).not.toMatch(/park/i);
    expect(qs('parties')).toContain('Do you offer parties?');
  });

  it('titles the highlights for what they are', () => {
    expect(highlightsHeading(program('parties'))).toBe('What’s included');
    expect(highlightsHeading(program('parents-night-out'))).toBe('What to expect');
    expect(highlightsHeading(program('geode-acting-studio'))).toBe('What they’ll practice');
  });
});

describe('confirming a one-date booking', () => {
  const pnoOct = program('parents-night-out').sessions.find((s) => s.id === 'pno-2026-10-24')!;
  const improvOct = program('geode-adult-improv').sessions[0];

  it('says the date and the drop-off window, not a first class and a weekly time', () => {
    expect(oneOffWhen(program('parents-night-out'), pnoOct)).toBe('Saturday, October 24, 5–8 pm (drop-off from 5, pick-up by 8)');
    expect(oneOffWhen(program('geode-adult-improv'), improvOct)).toBe('Thursday, October 15, 6:30–8:30 pm');
  });

  it('asks the family to agree to rules that fit, not monthly tuition', () => {
    const pno = oneOffPolicies(program('parents-night-out'), pnoOct);
    expect(pno.join(' ')).not.toMatch(/monthly tuition is|unenroll|billing date/i);
    expect(pno).toContain('Drop off from 5 pm and pick up by 8 pm.');
    expect(oneOffPolicies(program('free-community-class'), program('free-community-class').sessions[0])[0]).toBe('It’s free: there’s nothing to pay.');
    expect(oneOffPolicies(program('geode-adult-improv'), improvOct)).toContain('Everyone taking part must be 18 or older.');
  });

  it('doesn’t tell grown-ups to walk their child in', () => {
    const parking = { walkIn: 'Park on Minor St and walk your child to the front of the building.', late: 'Doors lock 5 minutes after class starts.' };
    expect(arrivalLines(program('geode-adult-improv'), parking).join(' ')).not.toMatch(/child|student/i);
    expect(arrivalLines(program('parents-night-out'), parking)).not.toContain(parking.late);
    expect(arrivalLines(program('intro-to-theater'), parking)).toContain(parking.walkIn);
  });
});
