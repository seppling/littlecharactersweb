import { describe, expect, it } from 'vitest';
import { detailsOnFile, detailsSummary, needsDetailsForm } from '@/lib/student-details';

const now = new Date('2026-10-13T16:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe('the details step skips details confirmed within the year', () => {
  it('summarizes a student confirmed this year, and asks the rest', () => {
    expect(detailsOnFile({ detailsConfirmedAt: daysAgo(30) }, now)).toBe(true);
    expect(detailsOnFile({ detailsConfirmedAt: daysAgo(364) }, now)).toBe(true);
    expect(detailsOnFile({ detailsConfirmedAt: daysAgo(366) }, now)).toBe(false);
    expect(detailsOnFile({ detailsConfirmedAt: null }, now)).toBe(false);

    expect(needsDetailsForm({ id: 'ava', detailsConfirmedAt: daysAgo(30) }, null, now)).toBe(false);
    expect(needsDetailsForm({ id: 'ben', detailsConfirmedAt: null }, null, now)).toBe(true);
    expect(needsDetailsForm({ id: 'kai', detailsConfirmedAt: daysAgo(400) }, null, now)).toBe(true);
  });

  it('opens the form again when the family taps Edit', () => {
    expect(needsDetailsForm({ id: 'ava', detailsConfirmedAt: daysAgo(30) }, 'ava', now)).toBe(true);
    expect(needsDetailsForm({ id: 'ava', detailsConfirmedAt: daysAgo(30) }, 'ben', now)).toBe(false);
  });

  it('says what is on file in one line', () => {
    expect(detailsSummary({ firstName: 'Ava', allergies: 'Peanuts', medicalNotes: '', pickupNotes: null, photoConsent: true })).toBe('Allergies: Peanuts · photos OK');
    expect(detailsSummary({ firstName: 'Ben', allergies: '', medicalNotes: 'Asthma', pickupNotes: 'Grandma Lee', photoConsent: false })).toBe(
      'No allergies · medical notes on file · pick-up: Grandma Lee · no photos',
    );
  });
});
