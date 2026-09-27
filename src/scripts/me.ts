/**
 * Who's signed in, asked once per page. Public pages are the same for
 * everyone, so the header and the staff tools fill themselves in from this.
 * Only asks when the lc_signed_in hint cookie says it's worth it.
 */
export interface Me {
  signedIn: boolean;
  firstName?: string;
  upcoming?: number;
  isAdmin?: boolean;
}

let asked: Promise<Me | null> | undefined;

export function me(): Promise<Me | null> {
  asked ??= document.cookie.includes('lc_signed_in=1')
    ? fetch('/api/me', { credentials: 'same-origin' })
        .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
        .catch(() => null)
    : Promise.resolve(null);
  return asked;
}
