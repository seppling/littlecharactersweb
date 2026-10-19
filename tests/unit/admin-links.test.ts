import { describe, expect, it } from 'vitest';
import * as links from '@/lib/admin-links';

describe('the staff link contract', () => {
  it('gives every staff route one address', () => {
    expect(links.today()).toBe('/admin');
    expect(links.attention()).toBe('/admin/attention');
    expect(links.classes()).toBe('/admin/classes');
    expect(links.classPage('intro-f26-tue')).toBe('/admin/classes/intro-f26-tue');
    expect(links.classPrint('intro-f26-tue')).toBe('/admin/classes/intro-f26-tue/print');
    expect(links.classEmail('intro-f26-tue')).toBe('/admin/classes/intro-f26-tue/email');
    expect(links.search()).toBe('/admin/search');
    expect(links.search('  ')).toBe('/admin/search');
    expect(links.search('Rivera & Lee')).toBe('/admin/search?q=Rivera+%26+Lee');
    expect(links.family('h1')).toBe('/admin/families/h1');
    expect(links.payments()).toBe('/admin/payments');
    expect(links.payments('failed')).toBe('/admin/payments?show=failed');
    expect(links.payments(undefined, '2026-10')).toBe('/admin/payments?month=2026-10');
    expect(links.downloads(links.payments(undefined, '2026-10')).csv).toBe('/admin/payments.csv?month=2026-10');
    expect(links.paymentsOrder('o1')).toBe('/admin/payments/o1');
    expect(links.leads()).toBe('/admin/leads');
    expect(links.content()).toBe('/admin/content');
    expect(links.install()).toBe('/admin/install');
    expect(links.confirm('/admin/leads.csv')).toBe('/admin/confirm?next=%2Fadmin%2Fleads.csv');
  });

  it('escapes ids', () => {
    expect(links.family('a/b?c')).toBe('/admin/families/a%2Fb%3Fc');
  });

  it('puts downloads beside their list, with its filters', () => {
    expect(links.downloads('/admin/leads')).toEqual({ csv: '/admin/leads.csv', pdf: '/admin/leads.pdf' });
    expect(links.downloads('/admin/payments?show=failed')).toEqual({ csv: '/admin/payments.csv?show=failed', pdf: '/admin/payments.pdf?show=failed' });
  });
});

describe('return addresses after signing in', () => {
  it('allows staff paths on this site', () => {
    for (const ok of ['/admin', '/admin/leads.csv', '/admin/payments?show=failed', '/admin/classes/intro-f26-tue']) expect(links.safeStaffPath(ok), ok).toBe(ok);
  });

  it('turns away everything else', () => {
    for (const bad of [
      null,
      '',
      'https://evil.example/admin',
      '//evil.example/admin',
      '/\\evil.example',
      '/account',
      '/administrator',
      '/admin.evil',
      '/admin/../account',
      '/admin/%2e%2e/account',
      '/admin/%E0',
      'javascript:alert(1)',
      '/admin/ x',
    ]) {
      expect(links.safeStaffPath(bad), String(bad)).toBeNull();
    }
    expect(links.confirm('https://evil.example')).toBe('/admin/confirm?next=%2Fadmin');
  });
});
