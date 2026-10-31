//! The inputs read into the input mask of README §6.1, wired as README §2 maps them (D8).

use embedded_hal::digital::InputPin;
use jiro_core::types::InputMask;

/// Each GPIO read into the mask, with its bit. Y (GP21) and the joystick press (GP3) are unused,
/// so they are never read into the mask.
pub const MASK_PINS: [(u8, InputMask); 7] = [
    (2, InputMask::UP),
    (18, InputMask::DOWN),
    (16, InputMask::LEFT),
    (20, InputMask::RIGHT),
    (15, InputMask::A),
    (17, InputMask::B),
    (19, InputMask::X),
];

/// Reads each pin once; `pins[i]` is wired to the GPIO of `MASK_PINS[i]`. The inputs are
/// active-low: a pin that reads low sets its bit.
pub fn read_mask<P: InputPin>(pins: &mut [P; MASK_PINS.len()]) -> Result<InputMask, P::Error> {
    let mut bits = 0;
    for (pin, (_, input)) in pins.iter_mut().zip(MASK_PINS) {
        if pin.is_low()? {
            bits |= input.bits();
        }
    }
    Ok(InputMask::new(bits).expect("MASK_PINS leaves the reserved bit clear"))
}
