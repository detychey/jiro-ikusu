// The events of journal bytes v1 (README §6.3): eventCount at bytes 69-70, then a u16 tick and a
// u8 mask per event, big-endian. Only for journals the core has accepted: it is the decoder.

export const HEADER_LEN = 71;
export const EVENT_LEN = 3;

export interface JournalEvent {
  tick: number;
  mask: number;
}

export function journalEvents(journal: Uint8Array): JournalEvent[] {
  const count = ((journal[69] ?? 0) << 8) | (journal[70] ?? 0);
  return Array.from({ length: count }, (_, i) => {
    const at = HEADER_LEN + EVENT_LEN * i;
    return { tick: ((journal[at] ?? 0) << 8) | (journal[at + 1] ?? 0), mask: journal[at + 2] ?? 0 };
  });
}
