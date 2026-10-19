import { describe, expect, it } from 'vitest';
import { emergencyContactsInput, formatPhone, normalizePhone, pickupPeopleInput, smsHref, telHref } from '@/lib/contacts';

describe('phone numbers', () => {
  it('accepts the usual US formats and stores 10 digits', () => {
    for (const v of ['706-555-0142', '(706) 555-0142', '706.555.0142', '7065550142', ' 706 555 0142 ', '1-706-555-0142', '+1 706 555 0142', '+1 (706) 555-0142']) {
      expect(normalizePhone(v), v).toBe('7065550142');
    }
  });

  it('keeps a leading + for numbers outside the US', () => {
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('turns away what is not a phone number', () => {
    for (const v of ['', '555-0142', '12345', 'call me', '706-555-0142 ext 4', '106-555-0142', '+12', '0065550142']) {
      expect(normalizePhone(v), v).toBeNull();
    }
  });

  it('formats for display and links', () => {
    expect(formatPhone('7065550142')).toBe('(706) 555-0142');
    expect(formatPhone('+1 706 555 0142')).toBe('(706) 555-0142');
    expect(formatPhone('+442079460958')).toBe('+442079460958');
    expect(formatPhone(null)).toBe('');
    expect(telHref('7065550142')).toBe('tel:+17065550142');
    expect(smsHref('(706) 555-0142')).toBe('sms:+17065550142');
    expect(telHref('+442079460958')).toBe('tel:+442079460958');
  });
});

describe('contact lists', () => {
  const person = { name: 'June Carter', relationship: 'Grandma', phone: '(706) 555-0142' };

  it('stores normalized phones', () => {
    expect(emergencyContactsInput.parse([person])).toEqual([{ name: 'June Carter', relationship: 'Grandma', phone: '7065550142' }]);
  });

  it('allows up to 4 people', () => {
    expect(emergencyContactsInput.safeParse(Array(4).fill(person)).success).toBe(true);
    expect(emergencyContactsInput.safeParse(Array(5).fill(person)).success).toBe(false);
    expect(pickupPeopleInput.safeParse(Array(5).fill(person)).success).toBe(false);
  });

  it('limits names to 80 characters and relationships to 40', () => {
    expect(emergencyContactsInput.safeParse([{ ...person, name: 'a'.repeat(80) }]).success).toBe(true);
    expect(emergencyContactsInput.safeParse([{ ...person, name: 'a'.repeat(81) }]).success).toBe(false);
    expect(emergencyContactsInput.safeParse([{ ...person, relationship: 'a'.repeat(41) }]).success).toBe(false);
    expect(emergencyContactsInput.safeParse([{ ...person, name: '  ' }]).success).toBe(false);
  });

  it('needs a phone for an emergency contact, not for a pickup person', () => {
    expect(emergencyContactsInput.safeParse([{ ...person, phone: '' }]).success).toBe(false);
    expect(emergencyContactsInput.safeParse([{ ...person, phone: 'soon' }]).success).toBe(false);
    expect(pickupPeopleInput.parse([{ name: 'Sam Ortiz', relationship: 'Neighbor', phone: '' }])).toEqual([{ name: 'Sam Ortiz', relationship: 'Neighbor' }]);
    expect(pickupPeopleInput.parse([{ name: 'Sam Ortiz', relationship: 'Neighbor', phone: '706 555 0199' }])).toEqual([{ name: 'Sam Ortiz', relationship: 'Neighbor', phone: '7065550199' }]);
    expect(pickupPeopleInput.safeParse([{ name: 'Sam Ortiz', relationship: 'Neighbor', phone: 'nope' }]).success).toBe(false);
  });
});
