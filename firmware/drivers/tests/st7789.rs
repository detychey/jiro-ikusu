//! The display's byte stream, recorded on a mock bus: every byte with the level DC had.

use std::cell::RefCell;
use std::convert::Infallible;
use std::rc::Rc;

use embedded_hal::delay::DelayNs;
use embedded_hal::digital::{self, OutputPin};
use embedded_hal::spi::{self, SpiBus};
use jiro_core::types::Pos;
use jiro_firmware_drivers::st7789::{Error, INIT_SEQUENCE, St7789};

#[derive(Default)]
struct Wire {
    cs_low: bool,
    dc_high: bool,
    /// Each byte sent, with true for data (DC high) and false for a command (DC low).
    bytes: Vec<(bool, u8)>,
}

type SharedWire = Rc<RefCell<Wire>>;

struct Bus(SharedWire);

impl spi::ErrorType for Bus {
    type Error = Infallible;
}

impl SpiBus for Bus {
    fn read(&mut self, _: &mut [u8]) -> Result<(), Infallible> {
        unreachable!("the display is write-only")
    }

    fn write(&mut self, words: &[u8]) -> Result<(), Infallible> {
        let mut wire = self.0.borrow_mut();
        assert!(wire.cs_low, "bytes sent while CS is high");
        let data = wire.dc_high;
        wire.bytes.extend(words.iter().map(|&byte| (data, byte)));
        Ok(())
    }

    fn transfer(&mut self, _: &mut [u8], _: &[u8]) -> Result<(), Infallible> {
        unreachable!("the display is write-only")
    }

    fn transfer_in_place(&mut self, _: &mut [u8]) -> Result<(), Infallible> {
        unreachable!("the display is write-only")
    }

    fn flush(&mut self) -> Result<(), Infallible> {
        Ok(())
    }
}

enum Line {
    Cs,
    Dc,
    Rst,
}

struct Pin {
    line: Line,
    wire: SharedWire,
}

impl Pin {
    fn set(&mut self, high: bool) -> Result<(), Infallible> {
        let mut wire = self.wire.borrow_mut();
        match self.line {
            Line::Cs => wire.cs_low = !high,
            Line::Dc => wire.dc_high = high,
            Line::Rst => {}
        }
        Ok(())
    }
}

impl digital::ErrorType for Pin {
    type Error = Infallible;
}

impl OutputPin for Pin {
    fn set_low(&mut self) -> Result<(), Infallible> {
        self.set(false)
    }

    fn set_high(&mut self) -> Result<(), Infallible> {
        self.set(true)
    }
}

struct NoDelay;

impl DelayNs for NoDelay {
    fn delay_ns(&mut self, _: u32) {}
}

fn display() -> (St7789<Bus, Pin>, SharedWire) {
    let wire = SharedWire::default();
    let pin = |line| Pin {
        line,
        wire: Rc::clone(&wire),
    };
    let display = St7789::new(
        Bus(Rc::clone(&wire)),
        pin(Line::Cs),
        pin(Line::Dc),
        pin(Line::Rst),
    );
    (display, wire)
}

/// The commands on the wire, each with the data bytes that follow it.
fn commands(wire: &SharedWire) -> Vec<(u8, Vec<u8>)> {
    let mut commands: Vec<(u8, Vec<u8>)> = Vec::new();
    for &(data, byte) in &wire.borrow().bytes {
        if data {
            commands
                .last_mut()
                .expect("data before any command")
                .1
                .push(byte);
        } else {
            commands.push((byte, Vec::new()));
        }
    }
    commands
}

#[test]
fn init_sends_the_committed_table() {
    let (mut display, wire) = display();
    display.init(&mut NoDelay).unwrap();
    let table: Vec<(u8, Vec<u8>)> = INIT_SEQUENCE
        .iter()
        .map(|&(command, parameters)| (command, parameters.to_vec()))
        .collect();
    assert_eq!(commands(&wire), table);
}

#[test]
fn one_cell_emits_one_caset_raset_ramwr_window_of_16_pixels() {
    let (mut display, wire) = display();
    display.fill_cell(Pos { x: 59, y: 1 }, 0xF800).unwrap();
    assert_eq!(
        commands(&wire),
        [
            (0x2A, vec![0, 236, 0, 239]),
            (0x2B, vec![0, 4, 0, 7]),
            (0x2C, [0xF8, 0x00].repeat(16)),
        ]
    );
}

#[test]
fn a_cell_outside_the_grid_is_refused_before_any_byte() {
    let (mut display, wire) = display();
    let outside = Pos { x: 60, y: 0 };
    assert_eq!(
        display.fill_cell(outside, 0),
        Err(Error::OutsideGrid(outside))
    );
    assert!(wire.borrow().bytes.is_empty());
}
