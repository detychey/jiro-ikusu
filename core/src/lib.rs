#![no_std]
#![forbid(unsafe_code)]
#![cfg_attr(
    not(test),
    deny(
        clippy::float_arithmetic,
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::panic,
        clippy::arithmetic_side_effects,
        clippy::indexing_slicing
    )
)]

pub mod consts;
pub mod error;
pub mod grid;
pub mod journal;
pub mod keccak;
pub mod level;
pub mod types;

pub use error::Error;
