/**
 * The steps of the staff email pages (write → review → sent), shared by
 * "Email the class", "Email this family" and "Email a tag". The pages load the audience;
 * this reads the form, runs the step and says what to show next.
 * Sending and the log: ./messages.ts.
 */
import {
  MessageError,
  checkDraft,
  messageResult,
  newSendToken,
  pickRecipients,
  retryFailed,
  sendMessage,
  sendTest,
  type AudienceFamily,
  type SendOptions,
} from './messages';

export interface ComposerContext {
  kind: 'class' | 'family' | 'tag';
  /** The class (kind 'class'), or the tag's id (kind 'tag'). */
  sessionId?: string;
  /** The page's own address; steps come back to it. */
  here: string;
  audience: AudienceFamily[];
  footer: string;
  staff: { id: string; email: string };
}

export interface ComposerState {
  step: 'compose' | 'review';
  subject: string;
  body: string;
  includeWaitlist: boolean;
  /** Families still ticked; null before the form was first sent (everyone). */
  selected: Set<string> | null;
  recipients: AudienceFamily[];
  token?: string;
  notice?: string;
  error?: string;
}

export function blankState(ctx: ComposerContext): ComposerState {
  return { step: 'compose', subject: '', body: '', includeWaitlist: false, selected: null, recipients: pickRecipients(ctx.audience, { includeWaitlist: false, selected: null }) };
}

function readForm(form: FormData, ctx: ComposerContext) {
  const includeWaitlist = form.get('waitlist') === '1';
  // A family's page has one family and no ticks to read.
  const selected = ctx.kind === 'family' ? null : new Set(form.getAll('family').map(String));
  return {
    subject: String(form.get('subject') ?? ''),
    body: String(form.get('body') ?? ''),
    includeWaitlist,
    selected,
    recipients: pickRecipients(ctx.audience, { includeWaitlist, selected }),
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const familiesText = (n: number) => plural(n, 'family', 'families');

/** Runs one posted step: a redirect to follow, or the state to show. */
export async function composerStep(form: FormData, ctx: ComposerContext, opts: SendOptions = {}): Promise<{ redirect: string } | { state: ComposerState }> {
  const action = String(form.get('action') ?? '');
  const draft = readForm(form, ctx);
  const compose = (extra: Partial<ComposerState> = {}): { state: ComposerState } => ({ state: { step: 'compose', ...draft, ...extra } });
  try {
    switch (action) {
      case 'test':
        await sendTest(ctx.staff, { subject: draft.subject, body: draft.body, footer: ctx.footer }, opts);
        return compose({ notice: `Test sent to ${ctx.staff.email}. Check your inbox.` });
      case 'review': {
        const clean = checkDraft(draft.subject, draft.body);
        if (!draft.recipients.length) throw new MessageError('Tick at least one family.');
        return { state: { step: 'review', ...draft, ...clean, token: newSendToken() } };
      }
      case 'send': {
        if (!draft.recipients.length) throw new MessageError('Tick at least one family.');
        const { messageId, duplicate } = await sendMessage(
          { token: String(form.get('token') ?? ''), kind: ctx.kind, sessionId: ctx.sessionId, subject: draft.subject, body: draft.body, footer: ctx.footer, families: draft.recipients, staffId: ctx.staff.id },
          opts,
        );
        return { redirect: `${ctx.here}?sent=${encodeURIComponent(messageId)}${duplicate ? '&again=1' : ''}` };
      }
      case 'retry': {
        const id = String(form.get('message') ?? '');
        const result = await sentHere(id, ctx);
        if (!result) throw new MessageError('That email wasn’t found.');
        await retryFailed(id, ctx.staff.id, ctx.footer, opts);
        return { redirect: `${ctx.here}?sent=${encodeURIComponent(id)}&retried=1` };
      }
      default:
        return compose();
    }
  } catch (e) {
    if (!(e instanceof MessageError)) throw e;
    return compose({ error: e.message });
  }
}

/** A sent message, only when it belongs to this page (this class, this tag, or this family). */
export async function sentHere(messageId: string, ctx: Pick<ComposerContext, 'kind' | 'sessionId' | 'audience'>) {
  if (!messageId) return null;
  const m = await messageResult(messageId);
  if (!m || m.kind !== ctx.kind) return null;
  if (ctx.kind !== 'family' && m.sessionId !== ctx.sessionId) return null;
  if (ctx.kind === 'family' && !m.families.some((f) => f.householdId === ctx.audience[0]?.householdId)) return null;
  return m;
}
