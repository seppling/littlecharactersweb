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
    isAdmin: boolean;
    /** The site's content: published, or with unpublished edits while staff preview them. */
    content: import('./content/site-content').SiteContent;
    /** Staff are previewing unpublished edits. */
    preview: boolean;
  }
}
