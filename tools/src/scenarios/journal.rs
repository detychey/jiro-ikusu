//! Journal vectors: valid journals, and one malformed journal per decoder rule of README §6.3.

use jiro_core::Error;
use jiro_core::consts::{HEADER_LEN, MAX_EVENTS, MAX_JOURNAL_LEN, MAX_TICKS};
use jiro_core::journal::{Event, Header, Mode, encode};
use jiro_core::keccak::keccak256;
use jiro_core::types::InputMask;

use super::{Case, case, level};

/// README §6.3, the worked example `open-field-empty`.
const OPEN_FIELD_EMPTY: &str = "0x01000100277b9e3cebd776c6d46a8b4eb9b83ac165961f4b46a79baef5df1514bb5219cd04e24fd698778a8dbcf62ab0c9ed0228d67be3ddd3aeb682f4a67a53410dacc9000000";

const EVENT_COUNT_AT: usize = HEADER_LEN - 2;
const LEVEL_INDEX_AT: usize = HEADER_LEN - 3;

fn header() -> Header {
    Header {
        mode: Mode::Training,
        run_nonce: keccak256(&[b"jiro.example.9"]),
        level_id: level::open_field_id(),
        level_index: 0,
    }
}

fn event(tick: u16, mask: u8) -> Event {
    Event {
        tick,
        mask: InputMask::new(mask).expect("scenario masks leave bit 7 clear"),
    }
}

fn encoded(header: &Header, events: &[Event]) -> Vec<u8> {
    let mut out = [0; MAX_JOURNAL_LEN];
    encode(header, events, &mut out)
        .expect("valid scenarios encode")
        .to_vec()
}

/// The example header, then `events` written as raw bytes, so any rule can be broken.
fn raw(events: &[(u16, u8)]) -> Vec<u8> {
    let mut bytes = encoded(&header(), &[]);
    let count = u16::try_from(events.len()).expect("fewer than 65,536 events");
    bytes[EVENT_COUNT_AT..HEADER_LEN].copy_from_slice(&count.to_be_bytes());
    for (tick, mask) in events {
        bytes.extend(tick.to_be_bytes());
        bytes.push(*mask);
    }
    bytes
}

fn with_byte(mut bytes: Vec<u8>, at: usize, value: u8) -> Vec<u8> {
    bytes[at] = value;
    bytes
}

pub fn cases() -> Result<Vec<Case>, String> {
    let open_field_empty = encoded(&header(), &[]);
    if crate::json::hex(&open_field_empty) != OPEN_FIELD_EMPTY {
        return Err("open-field-empty differs from the README §6.3 worked example".to_string());
    }
    let challenge = Header {
        mode: Mode::Challenge,
        level_index: 5,
        ..header()
    };
    let full: Vec<Event> = (0..MAX_TICKS)
        .map(|tick| event(tick, 1 + (tick % 2) as u8))
        .collect();
    let two_events = raw(&[(0, 0x01), (1, 0x02)]);
    let mut short_events = two_events.clone();
    short_events.pop();
    let mut trailing = two_events.clone();
    trailing.push(0);
    let mut other_rules = two_events.clone();
    other_rules[1..3].copy_from_slice(&2u16.to_be_bytes());
    let mut too_many = raw(&[]);
    too_many[EVENT_COUNT_AT..HEADER_LEN].copy_from_slice(&(MAX_EVENTS + 1).to_be_bytes());
    Ok(vec![
        case("open-field-empty", open_field_empty, Ok(())),
        case("one-event", encoded(&header(), &[event(0, 0x01)]), Ok(())),
        case(
            "challenge-level-5",
            encoded(&challenge, &[event(10, 0x08), event(20, 0x00)]),
            Ok(()),
        ),
        case(
            "mask-returns-to-0",
            encoded(&header(), &[event(0, 0x01), event(5, 0x00), event(6, 0x7f)]),
            Ok(()),
        ),
        case(
            "last-tick-2699",
            encoded(&header(), &[event(MAX_TICKS - 1, 0x40)]),
            Ok(()),
        ),
        case("full-2700-events", encoded(&header(), &full), Ok(())),
        case(
            "truncated-header",
            open_field_empty_prefix(HEADER_LEN - 1),
            Err(Error::Truncated),
        ),
        case("truncated-events", short_events, Err(Error::Truncated)),
        case("trailing-bytes", trailing, Err(Error::TrailingBytes)),
        case(
            "unknown-version",
            with_byte(two_events.clone(), 0, 2),
            Err(Error::Version),
        ),
        case("other-rules-version", other_rules, Err(Error::RulesVersion)),
        case(
            "reserved-mode-2",
            with_byte(two_events.clone(), 3, 2),
            Err(Error::Mode),
        ),
        case(
            "unknown-mode-3",
            with_byte(two_events.clone(), 3, 3),
            Err(Error::Mode),
        ),
        case(
            "level-index-6",
            with_byte(two_events.clone(), LEVEL_INDEX_AT, 6),
            Err(Error::LevelIndex),
        ),
        case("event-count-2701", too_many, Err(Error::EventCount)),
        case(
            "tick-2700",
            raw(&[(0, 0x01), (MAX_TICKS, 0x02)]),
            Err(Error::TickLimit),
        ),
        case(
            "tick-not-increasing",
            raw(&[(5, 0x01), (5, 0x02)]),
            Err(Error::TickOrder),
        ),
        case(
            "reserved-bit-7",
            raw(&[(0, 0x01), (1, 0x81)]),
            Err(Error::ReservedBit),
        ),
        case(
            "unchanged-mask",
            raw(&[(0, 0x01), (1, 0x01)]),
            Err(Error::UnchangedMask),
        ),
        case("first-mask-0", raw(&[(0, 0x00)]), Err(Error::UnchangedMask)),
        case(
            "first-broken-event-wins",
            raw(&[(0, 0x00), (MAX_TICKS, 0x01)]),
            Err(Error::UnchangedMask),
        ),
    ])
}

fn open_field_empty_prefix(len: usize) -> Vec<u8> {
    let mut bytes = encoded(&header(), &[]);
    bytes.truncate(len);
    bytes
}
