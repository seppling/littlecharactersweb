/**
 * The demo build's clock (fakeClock in scripts/demo-data.ts): `new Date()`,
 * `Date.now()` and `Date()` read the story's time, it only moves forward, and
 * `restore()` puts the real Date back.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { fakeClock } from '../../scripts/demo-data';

const RealDate = Date;
afterEach(() => {
  globalThis.Date = RealDate;
});

describe('the demo clock', () => {
  it('sets now for new Date(), Date.now() and Date(), and leaves dates with arguments alone', () => {
    const clock = fakeClock(new RealDate('2026-08-03T12:00:00Z'));
    expect(Math.abs(new Date().getTime() - RealDate.parse('2026-08-03T12:00:00Z'))).toBeLessThan(1000);
    expect(Math.abs(Date.now() - RealDate.parse('2026-08-03T12:00:00Z'))).toBeLessThan(1000);
    expect(Date()).toContain('2026');
    expect(new Date('2020-01-02T00:00:00Z').toISOString()).toBe('2020-01-02T00:00:00.000Z');
    expect(new Date(0).getTime()).toBe(0);
    expect(new Date() instanceof RealDate).toBe(true);
    expect(Date.UTC(2026, 0, 1)).toBe(RealDate.UTC(2026, 0, 1));
    clock.restore();
    expect(globalThis.Date).toBe(RealDate);
  });

  it('only moves forward', () => {
    const clock = fakeClock(new RealDate('2026-09-01T12:00:00Z'));
    clock.set(new RealDate('2026-08-01T12:00:00Z'));
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-09-01');
    clock.set(new RealDate('2026-10-01T12:00:00Z'));
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-10-01');
    clock.restore();
  });
});
