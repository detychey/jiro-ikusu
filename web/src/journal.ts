// Journal bytes v1 (README §6.3): the level id the header names, at bytes 36-67, and the events,
// eventCount at bytes 69-70, then a u16 tick and a u8 mask per event, big-endian. Events are read
// only from journals the core has accepted: it is the decoder.

export const HEADER_LEN = 71;
export const EVENT_LEN = 3;
export const MAX_EVENTS = 2_700;
export const MAX_JOURNAL_LEN = HEADER_LEN + EVENT_LEN * MAX_EVENTS;
const LEVEL_ID_AT = 36;
const LEVEL_ID_LEN = 32;

export interface JournalEvent {
  tick: number;
  mask: number;
}

/** The level id the header names, or undefined when the bytes end before it: read before the
 *  core replays the journal, to find its level. */
export function journalLevelId(journal: Uint8Array): Uint8Array | undefined {
  return journal.length < LEVEL_ID_AT + LEVEL_ID_LEN ? undefined : journal.subarray(LEVEL_ID_AT, LEVEL_ID_AT + LEVEL_ID_LEN);
}

export function journalEvents(journal: Uint8Array): JournalEvent[] {
  const count = ((journal[69] ?? 0) << 8) | (journal[70] ?? 0);
  return Array.from({ length: count }, (_, i) => {
    const at = HEADER_LEN + EVENT_LEN * i;
    return { tick: ((journal[at] ?? 0) << 8) | (journal[at + 1] ?? 0), mask: journal[at + 2] ?? 0 };
  });
}
