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
  }
}
