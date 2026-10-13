/**
 * The care details step (/enroll/details). Details a guardian confirmed within
 * the past year aren't asked again: the step shows a one-line summary with an
 * "Edit" link instead, so a family signing up a second child or class goes
 * straight to the policies.
 */

const YEAR_MS = 365 * 86_400_000;

/** Details are on file, and a guardian confirmed them within the past year. */
export function detailsOnFile(s: { detailsConfirmedAt: Date | null }, now = new Date()) {
  return !!s.detailsConfirmedAt && now.getTime() - s.detailsConfirmedAt.getTime() < YEAR_MS;
}

export interface DetailsOnFile {
  firstName: string;
  allergies: string;
  medicalNotes: string;
  pickupNotes: string | null;
  photoConsent: boolean | null;
}

/** "No allergies · medical notes on file · photos OK": the one line shown in place of the form. */
export function detailsSummary(s: DetailsOnFile) {
  const parts = [
    s.allergies.trim() ? `Allergies: ${s.allergies.trim()}` : 'No allergies',
    s.medicalNotes.trim() ? 'medical notes on file' : '',
    s.pickupNotes?.trim() ? `pick-up: ${s.pickupNotes.trim()}` : '',
    s.photoConsent === true ? 'photos OK' : s.photoConsent === false ? 'no photos' : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

/**
 * Which students get the full form: those without fresh details, and the one
 * the family chose to edit.
 */
export function needsDetailsForm(s: { id: string; detailsConfirmedAt: Date | null }, editing: string | null, now = new Date()) {
  return !detailsOnFile(s, now) || editing === s.id;
}
