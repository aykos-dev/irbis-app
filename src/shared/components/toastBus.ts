/**
 * Imperative entry to the toast queue, usable outside React (the mutation cache, the API layer).
 * `ToastProvider` subscribes; inside components prefer `useToast()`.
 */
export type ToastVariant = 'success' | 'error' | 'info';

export type ToastAction = { label: string; onPress: () => void };

export type ToastInput = {
  variant: ToastVariant;
  message: string;
  /** Retry / Undo. */
  action?: ToastAction;
};

type Listener = (input: ToastInput) => void;

const listeners = new Set<Listener>();

export const toast = {
  show(input: ToastInput): void {
    listeners.forEach(listener => listener(input));
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
