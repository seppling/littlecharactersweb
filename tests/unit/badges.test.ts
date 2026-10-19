import { describe, expect, it } from 'vitest';
import { childBadges, daysToBirthday, type BadgeInput } from '@/lib/badges';

const none: BadgeInput = {
  hasAllergies: false,
  hasMedicalNotes: false,
  hasPickupNote: false,
  photoConsent: true,
  firstEnrolledAt: null,
  trial: false,
  birthdate: null,
};
const keys = (input: Partial<BadgeInput>, today = '2026-10-19') => childBadges({ ...none, ...input }, today).map((b) => b.key);

describe('child badges', () => {
  it('shows nothing when there is nothing to know', () => {
    expect(childBadges(none, '2026-10-19')).toEqual([]);
  });

  it('says Allergy when there are allergies, else Medical', () => {
    expect(childBadges({ ...none, hasAllergies: true, hasMedicalNotes: true }, '2026-10-19')[0]).toEqual({ key: 'medical', label: 'Allergy', tone: 'alert' });
    expect(childBadges({ ...none, hasMedicalNotes: true }, '2026-10-19')[0]).toEqual({ key: 'medical', label: 'Medical', tone: 'alert' });
  });

  it('flags a pickup note or a restricted pickup list', () => {
    expect(keys({ hasPickupNote: true })).toEqual(['pickup']);
    expect(keys({ restrictedPickup: true })).toEqual(['pickup']);
  });

  it('shows No photos only when the parent said no', () => {
    expect(keys({ photoConsent: false })).toEqual(['no-photos']);
    expect(keys({ photoConsent: null })).toEqual([]);
  });

  it('marks a child new for 30 days after their first enrollment', () => {
    expect(keys({ firstEnrolledAt: new Date('2026-09-19T16:00:00Z') })).toEqual(['new']);
    expect(keys({ firstEnrolledAt: new Date('2026-09-18T16:00:00Z') })).toEqual([]);
    // 11:30 pm in Athens on Sept 18 is still Sept 18 there.
    expect(keys({ firstEnrolledAt: new Date('2026-09-19T03:30:00Z') })).toEqual([]);
  });

  it('keeps a fixed order', () => {
    const all = childBadges(
      { hasAllergies: true, hasMedicalNotes: false, hasPickupNote: true, photoConsent: false, firstEnrolledAt: new Date('2026-10-18T12:00:00Z'), trial: true, birthdate: '2018-10-20' },
      '2026-10-19',
    );
    expect(all.map((b) => b.key)).toEqual(['medical', 'pickup', 'no-photos', 'new', 'trial', 'birthday']);
    expect(all.map((b) => b.tone)).toEqual(['alert', 'warning', 'neutral', 'good', 'neutral', 'good']);
  });

  it('marks a drop-in, after trial and before birthday', () => {
    const b = childBadges({ ...none, dropIn: true, birthdate: '2018-10-20' }, '2026-10-19');
    expect(b.map((x) => [x.key, x.label, x.tone])).toEqual([
      ['drop-in', 'Drop-in', 'neutral'],
      ['birthday', 'Birthday', 'good'],
    ]);
  });

  it('never carries the notes themselves', () => {
    const text = JSON.stringify(childBadges({ ...none, hasAllergies: true, hasPickupNote: true }, '2026-10-19'));
    expect(text).not.toMatch(/peanut/i);
    expect(Object.keys(childBadges({ ...none, hasAllergies: true }, '2026-10-19')[0]).sort()).toEqual(['key', 'label', 'tone']);
  });
});

describe('birthdays', () => {
  it('counts 3 days either side', () => {
    expect(keys({ birthdate: '2018-10-22' })).toEqual(['birthday']);
    expect(keys({ birthdate: '2018-10-16' })).toEqual(['birthday']);
    expect(keys({ birthdate: '2018-10-23' })).toEqual([]);
    expect(keys({ birthdate: '2018-10-15' })).toEqual([]);
  });

  it('works across New Year', () => {
    expect(daysToBirthday('2017-01-01', '2026-12-30')).toBe(2);
    expect(daysToBirthday('2017-12-30', '2027-01-02')).toBe(-3);
    expect(keys({ birthdate: '2017-01-02' }, '2026-12-30')).toEqual(['birthday']);
    expect(keys({ birthdate: '2017-12-29' }, '2027-01-02')).toEqual([]);
  });

  it('handles February 29', () => {
    // Not a leap year: celebrated on the 28th.
    expect(daysToBirthday('2016-02-29', '2027-02-28')).toBe(0);
    expect(daysToBirthday('2016-02-29', '2027-03-03')).toBe(-3);
    expect(keys({ birthdate: '2016-02-29' }, '2027-03-04')).toEqual([]);
    // Leap year: the 29th itself.
    expect(daysToBirthday('2016-02-29', '2028-02-29')).toBe(0);
    expect(daysToBirthday('2016-02-29', '2028-03-03')).toBe(-3);
    expect(keys({ birthdate: '2016-02-29' }, '2028-02-26')).toEqual(['birthday']);
  });
});
