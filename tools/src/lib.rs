//! Seeded randomness shared by the jiro-tools binary and jiro-core's property tests: a xorshift64
//! generator, random play, and the random cases of differential fuzzing.

pub mod cases;
pub mod random;
