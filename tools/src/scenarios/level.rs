//! Level vectors: valid levels, one invalid level per range and validity rule of README §5,
//! and the README §5 worked examples.

use jiro_core::Error;
use jiro_core::consts::LEVEL_LEN;
use jiro_core::level::{Level, Rect, encode, level_id};
use jiro_core::types::Pos;

use super::{Case, case};

/// README §5, the open-field level: bytes 451 to 471 and its level id.
const OPEN_FIELD_TAIL: &str = "0x051414222202000000000000000000000a8c031d4c";
const OPEN_FIELD_ID: &str = "0x04e24fd698778a8dbcf62ab0c9ed0228d67be3ddd3aeb682f4a67a53410dacc9";

pub fn open_field() -> Level {
    Level {
        obstacles: [0; 450],
        boss_size: 5,
        spawn: Rect {
            x0: 20,
            y0: 20,
            x1: 34,
            y1: 34,
        },
        boss_period: 2,
        minion_count: 0,
        minion_spawns: [Pos { x: 0, y: 0 }; 3],
        minion_period: 0,
        respawn_delay: 0,
        time_limit: 2_700,
        lives: 3,
        target_bp: 7_500,
    }
}

pub fn open_field_id() -> [u8; 32] {
    level_id(&encode(&open_field()))
}

fn with_obstacles(mut level: Level, cells: impl IntoIterator<Item = (u8, u8)>) -> Level {
    for (x, y) in cells {
        let cell = usize::from(y) * 60 + usize::from(x);
        level.obstacles[cell / 8] |= 0x80 >> (cell % 8);
    }
    level
}

fn with_minions(level: Level, spawns: &[(u8, u8)]) -> Level {
    let mut minion_spawns = [Pos { x: 0, y: 0 }; 3];
    for (slot, &(x, y)) in minion_spawns.iter_mut().zip(spawns) {
        *slot = Pos { x, y };
    }
    Level {
        minion_count: u8::try_from(spawns.len()).expect("at most 3 spawns"),
        minion_spawns,
        minion_period: 2,
        respawn_delay: 300,
        ..level
    }
}

fn rows_blocked(last_row: u8) -> Level {
    let rows = (1..=last_row).flat_map(|y| (1..59).map(move |x| (x, y)));
    let level = Level {
        spawn: Rect {
            x0: 20,
            y0: 40,
            x1: 34,
            y1: 45,
        },
        ..open_field()
    };
    with_obstacles(level, rows)
}

fn bytes(level: &Level) -> Vec<u8> {
    encode(level).to_vec()
}

pub fn cases() -> Result<Vec<Case>, String> {
    let open_field_bytes = bytes(&open_field());
    if crate::json::hex(&open_field_bytes[451..]) != OPEN_FIELD_TAIL
        || crate::json::hex(&level_id(&open_field_bytes)) != OPEN_FIELD_ID
    {
        return Err("open-field differs from the README §5 worked example".to_string());
    }
    let blocked_start = with_obstacles(open_field(), [(29, 58), (30, 58), (31, 58)]);
    if blocked_start.obstacles[438] != 0x07 {
        return Err(
            "blocked-start bitmap byte 438 differs from the README §5 worked example".to_string(),
        );
    }
    let field = open_field;
    let mut short = open_field_bytes.clone();
    short.truncate(LEVEL_LEN - 1);
    let mut version = open_field_bytes.clone();
    version[0] = 2;
    let mut unused_slot = with_minions(field(), &[(0, 0)]);
    unused_slot.minion_spawns[2] = Pos { x: 1, y: 1 };
    Ok(vec![
        case("open-field", open_field_bytes, Ok(())),
        case(
            "walls-and-minions",
            bytes(&with_minions(
                with_obstacles(
                    Level {
                        boss_size: 8,
                        spawn: Rect {
                            x0: 30,
                            y0: 25,
                            x1: 40,
                            y1: 31,
                        },
                        boss_period: 3,
                        time_limit: 1_800,
                        lives: 5,
                        target_bp: 8_000,
                        ..field()
                    },
                    (10..30).map(|x| (x, 15)).chain([(45, 40), (46, 40)]),
                ),
                &[(0, 0), (59, 30), (12, 0)],
            )),
            Ok(()),
        ),
        case(
            "b2-whole-interior-spawn",
            bytes(&Level {
                boss_size: 2,
                spawn: Rect {
                    x0: 1,
                    y0: 1,
                    x1: 57,
                    y1: 57,
                },
                ..field()
            }),
            Ok(()),
        ),
        case(
            "one-cell-spawn",
            bytes(&Level {
                spawn: Rect {
                    x0: 20,
                    y0: 30,
                    x1: 20,
                    y1: 30,
                },
                ..field()
            }),
            Ok(()),
        ),
        case("open-area-1682", bytes(&rows_blocked(29)), Ok(())),
        case("length-471", short, Err(Error::LevelLength)),
        case("unknown-version", version, Err(Error::LevelVersion)),
        case(
            "border-obstacle",
            bytes(&with_obstacles(field(), [(0, 30)])),
            Err(Error::BorderObstacle),
        ),
        case(
            "boss-size-1",
            bytes(&Level {
                boss_size: 1,
                ..field()
            }),
            Err(Error::BossSize),
        ),
        case(
            "boss-size-9",
            bytes(&Level {
                boss_size: 9,
                ..field()
            }),
            Err(Error::BossSize),
        ),
        case(
            "spawn-x0-above-x1",
            bytes(&Level {
                spawn: Rect {
                    x0: 21,
                    y0: 20,
                    x1: 20,
                    y1: 34,
                },
                ..field()
            }),
            Err(Error::SpawnOrder),
        ),
        case(
            "spawn-x1-60-minus-b",
            bytes(&Level {
                spawn: Rect {
                    x0: 20,
                    y0: 20,
                    x1: 55,
                    y1: 34,
                },
                ..field()
            }),
            Err(Error::SpawnBounds),
        ),
        case(
            "spawn-x1-255-b8",
            bytes(&Level {
                boss_size: 8,
                spawn: Rect {
                    x0: 20,
                    y0: 20,
                    x1: 255,
                    y1: 34,
                },
                ..field()
            }),
            Err(Error::SpawnBounds),
        ),
        case(
            "boss-period-0",
            bytes(&Level {
                boss_period: 0,
                ..field()
            }),
            Err(Error::BossPeriod),
        ),
        case(
            "minion-count-4",
            bytes(&Level {
                minion_count: 4,
                ..with_minions(field(), &[(0, 0), (59, 0), (0, 59)])
            }),
            Err(Error::MinionCount),
        ),
        case(
            "minion-spawn-x-60",
            bytes(&with_minions(field(), &[(60, 0)])),
            Err(Error::MinionSpawn),
        ),
        case(
            "unused-minion-slot",
            bytes(&unused_slot),
            Err(Error::MinionSlot),
        ),
        case(
            "minion-period-0-with-minions",
            bytes(&Level {
                minion_period: 0,
                ..with_minions(field(), &[(0, 0)])
            }),
            Err(Error::MinionPeriod),
        ),
        case(
            "respawn-delay-0-with-minions",
            bytes(&Level {
                respawn_delay: 0,
                ..with_minions(field(), &[(0, 0)])
            }),
            Err(Error::RespawnDelay),
        ),
        case(
            "time-limit-0",
            bytes(&Level {
                time_limit: 0,
                ..field()
            }),
            Err(Error::TimeLimit),
        ),
        case(
            "time-limit-2701",
            bytes(&Level {
                time_limit: 2_701,
                ..field()
            }),
            Err(Error::TimeLimit),
        ),
        case(
            "lives-0",
            bytes(&Level {
                lives: 0,
                ..field()
            }),
            Err(Error::Lives),
        ),
        case(
            "target-10001",
            bytes(&Level {
                target_bp: 10_001,
                ..field()
            }),
            Err(Error::Target),
        ),
        case(
            "open-area-split",
            bytes(&with_obstacles(field(), (1..59).map(|y| (30, y)))),
            Err(Error::OpenAreaSplit),
        ),
        case(
            "open-area-1681",
            bytes(&with_obstacles(rows_blocked(29), [(1, 30)])),
            Err(Error::OpenAreaSmall),
        ),
        case(
            "boss-spawn-on-obstacle",
            bytes(&with_obstacles(field(), [(38, 38)])),
            Err(Error::BossSpawn),
        ),
        case(
            "minion-spawn-off-rail",
            bytes(&with_minions(field(), &[(30, 30)])),
            Err(Error::MinionSpawnRail),
        ),
        case(
            "blocked-start",
            bytes(&blocked_start),
            Err(Error::PlayerStartRail),
        ),
    ])
}
