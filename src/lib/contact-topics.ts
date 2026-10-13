/**
 * The contact form's "What's it about?" choices. Links can pre-select one with
 * /contact?topic=<value> (the Schools page uses topic=schools). The server
 * uses the labels in the email to Hannah and in the sender's copy.
 */
export const CONTACT_TOPICS = [
  { value: 'general', label: 'A general question' },
  { value: 'class', label: 'Help picking a class' },
  { value: 'absence', label: 'My child will miss a class' },
  { value: 'camps', label: 'Camps & workshops' },
  { value: 'private-lessons', label: 'Private lessons' },
  { value: 'party', label: 'A party' },
  { value: 'scholarship', label: 'Scholarships & pay-what-you-can' },
  { value: 'needs', label: 'My child’s specific needs' },
  { value: 'schools', label: 'School or organization partnership' },
] as const;

/** "absence" → "My child will miss a class". Unknown values are shown as sent. */
export const topicLabel = (value: string) => CONTACT_TOPICS.find((t) => t.value === value)?.label ?? value;
