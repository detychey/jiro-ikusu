//! Seeded randomness shared by the jiro-tools binary and jiro-core's property tests: a xorshift64
//! generator, random play, and the random cases of differential fuzzing with `with_obstacles`,
//! which builds their levels and the scenarios' levels.

pub mod cases;
pub mod random;
