import { storage } from '../../../shared/storage';

/** The seat token the host gave this phone for room `code` (`camp.seats.<code>`). */
export function readSeatToken(code: string): string | undefined {
  return storage.getString(`camp.seats.${code}`);
}

export function saveSeatToken(code: string, seatToken: string): void {
  storage.setString(`camp.seats.${code}`, seatToken);
}

/** Removed or closed: the seat is gone, so is its token. */
export function clearSeatToken(code: string): void {
  storage.remove(`camp.seats.${code}`);
}
