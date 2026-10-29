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

#[inline(never)]
pub fn scratch_float(n: u32) -> u32 {
    let mut x = 0.0f32;
    for i in 0..n {
        x += i as f32 * 0.5;
    }
    x as u32
}
