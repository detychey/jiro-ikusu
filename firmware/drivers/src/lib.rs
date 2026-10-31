//! The device's drivers, generic over the embedded-hal 1.0 traits so that host tests can record
//! the SPI byte stream and drive the pins: the Pico-LCD-1.3's ST7789VW display, and the pins of
//! the input mask.

#![no_std]
#![forbid(unsafe_code)]

pub mod input;
pub mod st7789;
