/**
 * Shared shape for a Server Action driven by `useActionState`. A thrown
 * Error from a plain `<form action={...}>` (no useActionState) crashes into
 * Next's generic error overlay instead of showing an inline message next to
 * the form — this return-a-result-instead shape is what lets the client
 * component show the error in place (role="alert") without a full crash.
 */
export type FormActionState = { error: string | null };

export const FORM_ACTION_OK: FormActionState = { error: null };
