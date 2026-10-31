//! The pin-to-mask table of README §2, §6.1 and D8, and its active-low reading.

use std::convert::Infallible;

use embedded_hal::digital::{ErrorType, InputPin};
use jiro_firmware_drivers::input::{MASK_PINS, read_mask};

/// A pin held low (pressed) or high (released).
struct Held {
    low: bool,
}

impl ErrorType for Held {
    type Error = Infallible;
}

impl InputPin for Held {
    fn is_high(&mut self) -> Result<bool, Infallible> {
        Ok(!self.low)
    }

    fn is_low(&mut self) -> Result<bool, Infallible> {
        Ok(self.low)
    }
}

#[test]
fn each_mask_gpio_maps_to_its_readme_bit() {
    assert_eq!(
        MASK_PINS.map(|(gpio, input)| (gpio, input.bits())),
        [
            (2, 1 << 0),
            (18, 1 << 1),
            (16, 1 << 2),
            (20, 1 << 3),
            (15, 1 << 4),
            (17, 1 << 5),
            (19, 1 << 6),
        ]
    );
}

#[test]
fn y_and_the_joystick_press_are_never_read() {
    assert!(MASK_PINS.iter().all(|&(gpio, _)| gpio != 21 && gpio != 3));
}

#[test]
fn pins_that_read_low_set_their_bits() {
    let mut pins = [true, false, false, false, false, false, true].map(|low| Held { low });
    assert_eq!(read_mask(&mut pins).unwrap().bits(), 0b0100_0001);
}
