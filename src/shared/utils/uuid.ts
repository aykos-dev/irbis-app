/**
 * RFC 4122 version-4 UUID. Used for `Idempotency-Key` headers, where uniqueness matters and
 * secrecy does not (Hermes has no `crypto.randomUUID`).
 */
export function uuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random % 4) + 8;
    return value.toString(16);
  });
}
