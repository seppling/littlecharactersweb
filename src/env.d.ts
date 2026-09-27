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
    session: { id: string; expiresAt: Date } | null;
    isAdmin: boolean;
    /** The site's content: published, or with unpublished edits while staff preview them. */
    content: import('./content/site-content').SiteContent;
    /** Staff are previewing unpublished edits. */
    preview: boolean;
  }
}
