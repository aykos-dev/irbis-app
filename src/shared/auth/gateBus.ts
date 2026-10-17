/**
 * The log-in prompt's request channel (AccGate / AC7). `useRequireAccount` opens it with the
 * action to continue; the app shell shows the sheet; the auth flow calls `resume()` once the
 * user is signed in. Imperative like `toastBus` so it works from any feature without a provider.
 */

/** Why the prompt opens — picks the "Keep your …" copy (`auth.gate.reasons.<reason>`). */
export const gateReasons = ['xp', 'place', 'trip', 'post', 'progress'] as const;
export type GateReason = (typeof gateReasons)[number];

type Pending = { reason: GateReason; action: () => void };
type Listener = (reason: GateReason | null) => void;

let pending: Pending | null = null;
const listeners = new Set<Listener>();

function emit(reason: GateReason | null): void {
  listeners.forEach(listener => listener(reason));
}

export const authGate = {
  /** Guest hit a gated action: remember it and show the prompt. */
  open(reason: GateReason, action: () => void): void {
    pending = { reason, action };
    emit(reason);
  },

  /** Signed in: run the remembered action exactly once. */
  resume(): void {
    const current = pending;
    pending = null;
    current?.action();
  },

  /** "Not now", or the sign-in flow was closed without signing in: nothing is lost, nothing runs. */
  cancel(): void {
    pending = null;
  },

  /** The sheet itself went away (any reason). */
  closed(): void {
    emit(null);
  },

  hasPending(): boolean {
    return pending !== null;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
