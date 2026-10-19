/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: {
      id: string;
      name: string;
      email: string;
      emailVerified: boolean;
      phone?: string | null;
    } | null;
    /** When it was created (signing in) and last renewed: see src/server/staff.ts. */
    session: { id: string; expiresAt: Date; createdAt: Date; updatedAt: Date } | null;
    /** An owner (ADMIN_EMAILS, or added as an owner in Settings → Staff). Every Phase 1 staff page needs this. */
    isAdmin: boolean;
    /** The signed-in person's staff role, or null for families and signed-out visitors (src/server/staff.ts). */
    staffRole: 'owner' | 'teacher' | null;
    /** Their row in the staff table (what classes are assigned to), when staffRole is set. */
    staffId: string | null;
    /** The site's content: published, or with unpublished edits while staff preview them. */
    content: import('./content/site-content').SiteContent;
    /** Staff are previewing unpublished edits. */
    preview: boolean;
  }
}
