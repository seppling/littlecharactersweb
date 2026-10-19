/**
 * Shows (src/server/shows.ts): cast suggestions from the performing classes,
 * two roles for one child, the cast's order, photo permission read from the
 * child, the program download, rehearsal times in Athens across the
 * daylight-saving change, which teachers and families see which rehearsal,
 * and the calendar's rehearsal entry.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { EventItem, Location, Program, Session } from '@/content/types';
import { calendarDays, dailyScheduleTable, type CalendarData } from '@/server/calendar';
import type { ClassRow } from '@/server/classes';
import { getDb, schema } from '@/server/db';
import { classCalendar } from '@/lib/ics';
import {
  ShowError,
  addRehearsal,
  addToCast,
  athensInstant,
  athensParts,
  castList,
  castSheet,
  castSuggestions,
  changeEmail,
  changeQuery,
  childCalled,
  childRehearsals,
  familyShows,
  moveCast,
  performingSessions,
  photoPermission,
  programTable,
  readChangeQuery,
  rehearsalFamilies,
  rehearsalLine,
  rehearsalWhen,
  rehearsalsBetween,
  removeCast,
  removeRehearsal,
  roleLine,
  showDatesLabel,
  showList,
  teacherRehearsals,
  teacherSeesRehearsal,
  updateCast,
  updateRehearsal,
} from '@/server/shows';

// ── A made-up catalog: two performing classes and one that isn't ──
const sess = (id: string, over: Partial<Session> = {}): Session =>
  ({ id, term: 'Fall 2026', days: ['Tue'], start: '16:15', end: '17:00', startDate: '2026-10-20', endDate: '2026-12-15', locationId: 'hq', status: 'open', ...over }) as Session;
const songs = { slug: 'songs', kind: 'class', title: 'Songs Class', sessions: [sess('songs-f26'), sess('songs-s26', { startDate: '2026-03-01', endDate: '2026-05-01' })] } as unknown as Program;
const acting = { slug: 'acting', kind: 'class', title: 'Acting Class', sessions: [sess('acting-f26', { days: ['Wed'] })] } as unknown as Program;
const other = { slug: 'other', kind: 'class', title: 'Other Class', sessions: [sess('other-f26', { days: ['Thu'] })] } as unknown as Program;
const showEvent = { slug: 'winter-show', title: 'Winter Show', kind: 'show', times: [{ start: '2026-12-12T18:00', end: '2026-12-12T19:30' }], performers: ['songs', 'acting'], gel: 'purple' } as unknown as EventItem;
const undated = { slug: 'spring-show', title: 'Spring Show', kind: 'show', times: [], tba: '2027-04', performers: ['songs'] } as unknown as EventItem;
const past = { slug: 'old-show', title: 'Old Show', kind: 'show', times: [{ start: '2026-09-27T13:30', end: '2026-09-27T14:00' }] } as unknown as EventItem;
const notShow = { slug: 'pno', title: 'Parents Night Out', kind: 'drop-off', times: [] } as unknown as EventItem;
const locations: Location[] = [{ id: 'hq', name: 'Little Characters HQ', shortName: 'HQ', address: ['1 Main St'], mapUrl: '' }];
const programs = [songs, acting, other];
const content = {
  events: [showEvent, undated, past, notShow],
  programs,
  locations,
  findSession: (id: string) => {
    for (const program of programs) for (const session of program.sessions) if (session.id === id) return { program, session };
    return undefined;
  },
  locationById: (id: string | undefined) => locations.find((l) => l.id === id),
} as never;

const TODAY = '2026-11-02';
let userId = '';
const kid: Record<string, string> = {};
const fam: Record<string, string> = {};
const teacher: Record<string, string> = {};

beforeAll(async () => {
  const db = await getDb();
  const [u] = await db.insert(schema.user).values({ id: 'shows-owner', name: 'Owner Sample', email: 'owner.sample@example.com', emailVerified: true }).returning();
  userId = u.id;
  for (const name of ['Penwick', 'Larkspur', 'Outsider']) {
    const [h] = await db.insert(schema.household).values({ name: `${name} Family` }).returning();
    fam[name] = h.id;
  }
  const kids: [string, string, boolean | null][] = [
    ['Ada', 'Penwick', true],
    ['Bo', 'Penwick', false],
    ['Cy', 'Larkspur', null],
    ['Di', 'Larkspur', true],
    ['Ed', 'Outsider', true],
  ];
  for (const [first, family, photo] of kids) {
    const [s] = await db.insert(schema.student).values({ householdId: fam[family], firstName: first, lastName: family, birthdate: '2017-01-01', photoConsent: photo }).returning();
    kid[first] = s.id;
  }
  await db.insert(schema.enrollment).values([
    { householdId: fam.Penwick, studentId: kid.Ada, sessionId: 'songs-f26', programSlug: 'songs', status: 'active' },
    { householdId: fam.Penwick, studentId: kid.Bo, sessionId: 'acting-f26', programSlug: 'acting', status: 'trial' },
    { householdId: fam.Larkspur, studentId: kid.Cy, sessionId: 'songs-f26', programSlug: 'songs', status: 'waitlist' },
    { householdId: fam.Larkspur, studentId: kid.Di, sessionId: 'acting-f26', programSlug: 'acting', status: 'active' },
    { householdId: fam.Outsider, studentId: kid.Ed, sessionId: 'other-f26', programSlug: 'other', status: 'active' },
    { householdId: fam.Larkspur, studentId: kid.Cy, sessionId: 'songs-s26', programSlug: 'songs', status: 'cancelled' },
  ]);
  for (const name of ['Songs Teacher', 'Acting Teacher']) {
    const [s] = await db.insert(schema.staff).values({ email: `${name.toLowerCase().replace(' ', '.')}@example.com`, name, role: 'teacher', active: true }).returning();
    teacher[name] = s.id;
  }
  await db.insert(schema.classTeacher).values([
    { sessionId: 'songs-f26', staffId: teacher['Songs Teacher'], role: 'lead' },
    { sessionId: 'acting-f26', staffId: teacher['Acting Teacher'], role: 'lead' },
  ]);
});

describe('the shows list', () => {
  it('lists shows only: upcoming soonest first and undated last, then past ones', () => {
    const list = showList([showEvent, undated, past, notShow], new Map([['winter-show', 3]]), content, TODAY);
    expect(list.upcoming.map((s) => s.event.slug)).toEqual(['winter-show', 'spring-show']);
    expect(list.past.map((s) => s.event.slug)).toEqual(['old-show']);
    expect(list.upcoming[0].cast).toBe(3);
    expect(list.upcoming[0].performers.map((p) => p.title)).toEqual(['Songs Class', 'Acting Class']);
  });
  it('words the dates, and a show with no date yet', () => {
    expect(showDatesLabel(showEvent)).toBe('Sat, Dec 12, 6 pm');
    expect(showDatesLabel(undated)).toBe('Date to come (April 2027)');
  });
});

describe('cast suggestions', () => {
  it('are the performing classes’ current sessions, not ended ones or other classes', () => {
    expect(performingSessions(showEvent, content, TODAY).map((s) => s.session.id)).toEqual(['songs-f26', 'acting-f26']);
    // A past show: the sessions that ran on its date.
    expect(performingSessions({ ...past, performers: ['songs'] } as EventItem, content, '2027-06-01').map((s) => s.session.id)).toEqual([]);
  });
  it('offer children enrolled or on a trial, never waitlisted, cancelled or in other classes', async () => {
    const s = await castSuggestions(showEvent, content, TODAY);
    expect(s.map((x) => x.session.id)).toEqual(['songs-f26', 'acting-f26']);
    expect(s[0].children.map((c) => c.name)).toEqual(['Ada Penwick']);
    expect(s[1].children.map((c) => [c.name, c.trial])).toEqual([
      ['Bo Penwick', true],
      ['Di Larkspur', false],
    ]);
  });
});

describe('the cast', () => {
  it('adds children at the end, skipping one already there with that role', async () => {
    expect(await addToCast('winter-show', [kid.Ada, kid.Bo, kid.Di], userId)).toBe(3);
    expect(await addToCast('winter-show', [kid.Ada], userId)).toBe(0);
    expect((await castList('winter-show')).map((c) => c.firstName)).toEqual(['Ada', 'Bo', 'Di']);
    const s = await castSuggestions(showEvent, content, TODAY);
    expect(s[0].children[0].inCast).toBe(true);
  });

  it('gives one child two roles, but not the same role twice', async () => {
    const [ada] = await castList('winter-show');
    await updateCast('winter-show', ada.id, { role: '  Narrator ', group: 'Act 1' }, userId);
    expect(await addToCast('winter-show', [kid.Ada], userId, { role: 'Tree', group: 'Ensemble' })).toBe(1);
    const rows = (await castList('winter-show')).filter((c) => c.studentId === kid.Ada);
    expect(rows.map((r) => [r.role, r.group])).toEqual([
      ['Narrator', 'Act 1'],
      ['Tree', 'Ensemble'],
    ]);
    await expect(updateCast('winter-show', rows[1].id, { role: 'Narrator', group: '' }, userId)).rejects.toThrow(ShowError);
  });

  it('reorders with up and down, and removes one role', async () => {
    let cast = await castList('winter-show');
    expect(cast.map((c) => `${c.firstName} ${c.role}`)).toEqual(['Ada Narrator', 'Bo ', 'Di ', 'Ada Tree']);
    await moveCast('winter-show', cast[3].id, 'up', userId);
    await moveCast('winter-show', cast[1].id, 'up', userId);
    cast = await castList('winter-show');
    expect(cast.map((c) => `${c.firstName} ${c.role}`)).toEqual(['Bo ', 'Ada Narrator', 'Ada Tree', 'Di ']);
    expect(cast.map((c) => c.position)).toEqual([0, 1, 2, 3]);
    // Moving the first up changes nothing.
    await moveCast('winter-show', cast[0].id, 'up', userId);
    expect((await castList('winter-show'))[0].firstName).toBe('Bo');
    await updateCast('winter-show', cast[0].id, { role: 'Wolf', group: '' }, userId);
    await updateCast('winter-show', cast[3].id, { role: 'Moon', group: 'Act 2' }, userId);
  });

  it('reads photo permission from the child: yes, no, or not asked', async () => {
    expect([photoPermission(true), photoPermission(false), photoPermission(null)]).toEqual(['yes', 'no', 'not-asked']);
    await addToCast('winter-show', [kid.Cy], userId, { role: 'Star' });
    const cast = await castList('winter-show');
    expect(Object.fromEntries(cast.map((c) => [c.firstName, c.photo]))).toEqual({ Ada: 'yes', Bo: 'no', Di: 'yes', Cy: 'not-asked' });
    // Changing the child's record changes the cast list: nothing is copied.
    const db = await getDb();
    const { eq } = await import('drizzle-orm');
    await db.update(schema.student).set({ photoConsent: true }).where(eq(schema.student.id, kid.Cy));
    expect((await castList('winter-show')).find((c) => c.firstName === 'Cy')?.photo).toBe('yes');
    expect(Object.keys(schema.showCast)).not.toContain('photoConsent');
    const removed = (await castList('winter-show')).find((c) => c.firstName === 'Cy')!;
    await removeCast('winter-show', removed.id, userId);
  });

  it('downloads the program cast list: name, role and group, in the cast’s order', async () => {
    const t = programTable(await castList('winter-show'));
    expect(t.headers).toEqual(['Name', 'Role', 'Group']);
    expect(t.rows).toEqual([
      ['Bo Penwick', 'Wolf', ''],
      ['Ada Penwick', 'Narrator', 'Act 1'],
      ['Ada Penwick', 'Tree', 'Ensemble'],
      ['Di Larkspur', 'Moon', 'Act 2'],
    ]);
  });

  it('adds photos, class and parents’ phones on the staff sheet, never care details', async () => {
    const t = await castSheet('winter-show', showEvent, content, TODAY);
    expect(t.headers).toEqual(['Name', 'Role', 'Group', 'Photos', 'Class', 'Parents’ phones']);
    expect(t.rows[0].slice(0, 5)).toEqual(['Bo Penwick', 'Wolf', '', 'No', 'Acting Class']);
    expect(t.rows[3].slice(3, 5)).toEqual(['Yes', 'Acting Class']);
    expect(JSON.stringify(t)).not.toMatch(/allerg|medical/i);
  });

  it('writes every change to the audit log with ids, not names', async () => {
    const db = await getDb();
    const rows = await db.select().from(schema.auditLog);
    const cast = rows.filter((r) => r.action.startsWith('admin.cast.'));
    expect(new Set(cast.map((r) => r.action))).toEqual(new Set(['admin.cast.add', 'admin.cast.update', 'admin.cast.move', 'admin.cast.remove']));
    expect(JSON.stringify(cast)).not.toMatch(/Penwick|Larkspur|Narrator/);
  });
});

describe('rehearsal times in Athens', () => {
  it('stores Athens wall-clock times as instants across the daylight-saving change (Nov 1, 2026)', () => {
    expect(athensInstant('2026-10-31', '10:00').toISOString()).toBe('2026-10-31T14:00:00.000Z');
    expect(athensInstant('2026-11-01', '10:00').toISOString()).toBe('2026-11-01T15:00:00.000Z');
    expect(athensInstant('2026-11-07', '10:00').toISOString()).toBe('2026-11-07T15:00:00.000Z');
    // The hour that happens twice: the first one (still daylight time).
    expect(athensInstant('2026-11-01', '01:30').toISOString()).toBe('2026-11-01T05:30:00.000Z');
    // The hour skipped in spring falls forward safely.
    expect(athensInstant('2027-03-14', '02:30').toISOString()).toBe('2027-03-14T07:30:00.000Z');
  });
  it('shows them back in Athens time', () => {
    const r = { startsAt: athensInstant('2026-11-14', '10:00'), endsAt: athensInstant('2026-11-14', '12:00'), locationId: 'hq' };
    expect(athensParts(r.startsAt)).toEqual({ date: '2026-11-14', time: '10:00' });
    expect(rehearsalWhen(r)).toBe('Sat, Nov 14, 10 am–12 pm');
    expect(rehearsalLine(r, content)).toBe('Rehearsal: Sat, Nov 14, 10 am–12 pm, HQ');
    expect(rehearsalWhen({ startsAt: athensInstant('2026-10-31', '16:30'), endsAt: athensInstant('2026-10-31', '17:30') })).toBe('Sat, Oct 31, 4:30–5:30 pm');
  });
  it('finds rehearsals by Athens date on both sides of the change', async () => {
    const before = await addRehearsal('winter-show', { date: '2026-10-31', start: '18:00', end: '20:00', locationId: 'hq', sessionIds: ['songs-f26'] }, userId, content);
    const after = await addRehearsal('winter-show', { date: '2026-11-01', start: '19:30', end: '21:00', sessionIds: [] }, userId, content);
    // 8 pm on Oct 31 is Nov 1 in UTC, but Oct 31 in Athens.
    expect((await rehearsalsBetween('2026-10-31', '2026-10-31')).map((r) => r.id)).toEqual([before.id]);
    expect((await rehearsalsBetween('2026-11-01', '2026-11-01')).map((r) => r.id)).toEqual([after.id]);
    await removeRehearsal('winter-show', before.id, userId);
    await removeRehearsal('winter-show', after.id, userId);
  });
  it('refuses an end before the start, and a place not in the content', async () => {
    await expect(addRehearsal('winter-show', { date: '2026-11-14', start: '12:00', end: '10:00', sessionIds: [] }, userId, content)).rejects.toThrow('The end time must be after the start time');
    await expect(addRehearsal('winter-show', { date: '2026-11-14', start: '10:00', end: '12:00', locationId: 'nowhere', sessionIds: [] }, userId, content)).rejects.toThrow(ShowError);
  });
});

describe('who sees which rehearsal', () => {
  let songsOnly = '';
  let wholeCast = '';
  beforeAll(async () => {
    songsOnly = (await addRehearsal('winter-show', { date: '2026-11-14', start: '10:00', end: '12:00', locationId: 'hq', note: 'Bring water', sessionIds: ['songs-f26'] }, userId, content)).id;
    wholeCast = (await addRehearsal('winter-show', { date: '2026-12-05', start: '13:00', end: '15:00', sessionIds: [] }, userId, content)).id;
  });

  it('the pure rules', () => {
    expect(teacherSeesRehearsal('owner', new Set(), ['a'])).toBe(true);
    expect(teacherSeesRehearsal('teacher', new Set(['a']), ['a', 'b'])).toBe(true);
    expect(teacherSeesRehearsal('teacher', new Set(['c']), ['a', 'b'])).toBe(false);
    expect(childCalled({ sessionIds: [] }, new Set())).toBe(true);
    expect(childCalled({ sessionIds: ['a'] }, new Set(['a']))).toBe(true);
    expect(childCalled({ sessionIds: ['a'] }, new Set(['b']))).toBe(false);
  });

  it('teachers of the rehearsing classes see it on their Today; others don’t; owners see all', async () => {
    const songsT = await teacherRehearsals({ staffId: teacher['Songs Teacher'], role: 'teacher' }, '2026-11-14', content);
    expect(songsT.map((r) => [r.id, r.time, r.place, r.note, r.classes])).toEqual([[songsOnly, '10 am–12 pm', 'HQ', 'Bring water', 'Songs Class']]);
    expect(await teacherRehearsals({ staffId: teacher['Acting Teacher'], role: 'teacher' }, '2026-11-14', content)).toEqual([]);
    expect((await teacherRehearsals({ staffId: 'any', role: 'owner' }, '2026-11-14', content)).length).toBe(1);
    // The whole cast: teachers of every performing class.
    for (const t of ['Songs Teacher', 'Acting Teacher']) {
      expect((await teacherRehearsals({ staffId: teacher[t], role: 'teacher' }, '2026-12-05', content)).map((r) => r.classes)).toEqual(['Whole cast']);
    }
    // The card carries no cast.
    expect(JSON.stringify(songsT)).not.toMatch(/Penwick|Larkspur/);
  });

  it('families see their own child’s roles, and the rehearsals that child is called to', async () => {
    const now = new Date('2026-11-02T12:00:00Z');
    const penwick = await familyShows(fam.Penwick, content, now);
    const ada = penwick.find((s) => s.firstName === 'Ada')!;
    const bo = penwick.find((s) => s.firstName === 'Bo')!;
    expect(roleLine(ada)).toBe('Ada: Narrator, Tree, in Winter Show');
    expect(ada.rehearsals.map((r) => r.line)).toEqual(['Rehearsal: Sat, Nov 14, 10 am–12 pm, HQ', 'Rehearsal: Sat, Dec 5, 1–3 pm']);
    // Bo is in the acting class: only the whole-cast rehearsal.
    expect(roleLine(bo)).toBe('Bo: Wolf, in Winter Show');
    expect(bo.rehearsals.map((r) => r.id)).toEqual([wholeCast]);
    // Nothing about other families' children.
    expect(JSON.stringify(penwick)).not.toMatch(/Larkspur|Moon|Di\b/);
    // A family with no child in the cast sees nothing.
    expect(await familyShows(fam.Outsider, content, now)).toEqual([]);
    // Past rehearsals drop off.
    expect((await familyShows(fam.Penwick, content, new Date('2026-11-20T12:00:00Z'))).find((s) => s.firstName === 'Ada')!.rehearsals.map((r) => r.id)).toEqual([wholeCast]);
  });

  it('puts the child’s rehearsals for that class in the class’s calendar file', async () => {
    const forSongs = await childRehearsals(kid.Ada, 'songs-f26', content, new Date('2026-11-02T12:00:00Z'));
    expect(forSongs.map((r) => r.id)).toEqual([songsOnly, wholeCast]);
    expect((await childRehearsals(kid.Bo, 'acting-f26', content, new Date('2026-11-02T12:00:00Z'))).map((r) => r.id)).toEqual([wholeCast]);
    const ics = classCalendar({
      session: sess('songs-f26'),
      first: '2026-11-03',
      uid: 'x@example.com',
      summary: 'Ada: Songs Class',
      description: 'd',
      prodId: '-//Test//EN',
      now: new Date('2026-11-02T12:00:00Z'),
      extras: forSongs.map((r) => ({ uid: `rehearsal-${r.id}`, start: r.startsAt, end: r.endsAt, summary: `Ada: Rehearsal, ${r.showTitle}` })),
    });
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(3);
    expect(ics).toContain('DTSTART:20261114T150000Z');
    expect(ics).toContain('SUMMARY:Ada: Rehearsal\\, Winter Show');
  });

  it('a change offers the email to the families called to it, filled in', async () => {
    expect(await rehearsalFamilies('winter-show', { sessionIds: ['songs-f26'] })).toEqual(new Set([fam.Penwick]));
    expect(await rehearsalFamilies('winter-show', { sessionIds: [] })).toEqual(new Set([fam.Penwick, fam.Larkspur]));
    const was = await updateRehearsal('winter-show', songsOnly, { date: '2026-11-14', start: '11:00', end: '13:00', locationId: 'hq', sessionIds: ['songs-f26'] }, userId, content);
    const q = new URLSearchParams(changeQuery('changed', was, songsOnly));
    expect(q.toString()).not.toMatch(/Ada|Penwick/);
    const back = readChangeQuery(q)!;
    expect(back.about).toBe('changed');
    expect(back.was.sessionIds).toEqual(['songs-f26']);
    const now = (await rehearsalsBetween('2026-11-14', '2026-11-14'))[0];
    const e = changeEmail('changed', 'Winter Show', back.was, now, content);
    expect(e.subject).toBe('Rehearsal changed: Winter Show');
    expect(e.body).toContain('The Winter Show rehearsal on Sat, Nov 14, 10 am–12 pm has changed.');
    expect(e.body).toContain('It’s now Sat, Nov 14, 11 am–1 pm, at HQ.');
    expect(changeEmail('removed', 'Winter Show', back.was, null, content).body).toBe('The Winter Show rehearsal on Sat, Nov 14, 10 am–12 pm is cancelled.');
    expect(readChangeQuery(new URLSearchParams('about=nope'))).toBeNull();
  });
});

describe('the calendar', () => {
  const row = { program: songs, session: sess('songs-f26'), label: '', teacher: 'Site Teacher', location: 'HQ', filled: 3, capacity: 12 } as unknown as ClassRow;
  const data: CalendarData = {
    rows: [row],
    events: [],
    daysOff: [],
    teachers: new Map([['songs-f26', ['Songs Teacher']]]),
    rehearsals: [{ id: 'r1', showSlug: 'winter-show', showTitle: 'Winter Show', date: '2026-11-14', start: '10:00', end: '12:00', locationId: 'hq', location: 'HQ', sessionIds: ['songs-f26'], classes: 'Songs Class' }],
  };
  it('adds a rehearsal entry linking to the show’s staff page', () => {
    const [day] = calendarDays(data, ['2026-11-14'], {}, content);
    expect(day.entries).toEqual([
      expect.objectContaining({ kind: 'rehearsal', title: 'Rehearsal: Winter Show', time: '10 am–12 pm', label: 'Songs Class', location: 'HQ', href: '/admin/shows/winter-show', sessionId: null, rosterHref: null }),
    ]);
    expect(dailyScheduleTable([day]).rows[0]).toEqual(['Sat, Nov 14, 2026', '10 am–12 pm', 'Rehearsal: Winter Show (Songs Class)', 'HQ', '', '', '']);
  });
  it('follows the program, place and teacher filters', () => {
    const count = (f: Parameters<typeof calendarDays>[2]) => calendarDays(data, ['2026-11-14'], f, content)[0].entries.length;
    expect(count({ program: 'songs' })).toBe(1);
    expect(count({ program: 'acting' })).toBe(0);
    expect(count({ location: 'hq' })).toBe(1);
    expect(count({ location: 'annex' })).toBe(0);
    expect(count({ teacher: 'Songs Teacher' })).toBe(1);
    expect(count({ teacher: 'Someone Else' })).toBe(0);
  });
});
