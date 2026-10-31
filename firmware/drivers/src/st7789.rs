//! The Pico-LCD-1.3's ST7789VW: 240 × 240 RGB565 pixels on a 4-wire SPI bus (README §2). The
//! screen shows the 60 × 60 grid at 4 × 4 pixels per cell, and is redrawn cell by cell.

use embedded_hal::delay::DelayNs;
use embedded_hal::digital::{OutputPin, PinState};
use embedded_hal::spi::SpiBus;
use jiro_core::consts::W;
use jiro_core::types::Pos;

/// Pixels along a cell's side.
const CELL_PIXELS: u16 = 4;

const MADCTL: u8 = 0x36;
const COLMOD: u8 = 0x3A;
const PORCTRL: u8 = 0xB2;
const GCTRL: u8 = 0xB7;
const VCOMS: u8 = 0xBB;
const LCMCTRL: u8 = 0xC0;
const VDVVRHEN: u8 = 0xC2;
const VRHS: u8 = 0xC3;
const VDVS: u8 = 0xC4;
const FRCTRL2: u8 = 0xC6;
const PWCTRL1: u8 = 0xD0;
const PVGAMCTRL: u8 = 0xE0;
const NVGAMCTRL: u8 = 0xE1;
const INVON: u8 = 0x21;
const SLPOUT: u8 = 0x11;
const DISPON: u8 = 0x29;
const CASET: u8 = 0x2A;
const RASET: u8 = 0x2B;
const RAMWR: u8 = 0x2C;

/// Waveshare's initialization of the Pico-LCD-1.3, sent after the reset, as its demo's
/// `LCD_1IN3_Init(HORIZONTAL)` sends it: each command with its parameters.
pub const INIT_SEQUENCE: &[(u8, &[u8])] = &[
    (MADCTL, &[0x70]),
    (COLMOD, &[0x05]),
    (PORCTRL, &[0x0C, 0x0C, 0x00, 0x33, 0x33]),
    (GCTRL, &[0x35]),
    (VCOMS, &[0x19]),
    (LCMCTRL, &[0x2C]),
    (VDVVRHEN, &[0x01]),
    (VRHS, &[0x12]),
    (VDVS, &[0x20]),
    (FRCTRL2, &[0x0F]),
    (PWCTRL1, &[0xA4, 0xA1]),
    (
        PVGAMCTRL,
        &[
            0xD0, 0x04, 0x0D, 0x11, 0x13, 0x2B, 0x3F, 0x54, 0x4C, 0x18, 0x0D, 0x0B, 0x1F, 0x23,
        ],
    ),
    (
        NVGAMCTRL,
        &[
            0xD0, 0x04, 0x0C, 0x11, 0x13, 0x2C, 0x3F, 0x44, 0x51, 0x2F, 0x1F, 0x1F, 0x20, 0x23,
        ],
    ),
    (INVON, &[]),
    (SLPOUT, &[]),
    (DISPON, &[]),
];

/// A failure of the bus or of a pin, or a cell outside the grid, refused before any byte is sent.
#[derive(Debug, PartialEq, Eq)]
pub enum Error<SpiError, PinError> {
    Spi(SpiError),
    Pin(PinError),
    OutsideGrid(Pos),
}

/// The display on `spi`, with its chip select, data/command and reset pins.
pub struct St7789<Spi, Pin> {
    spi: Spi,
    cs: Pin,
    dc: Pin,
    rst: Pin,
}

impl<Spi: SpiBus, Pin: OutputPin> St7789<Spi, Pin> {
    pub fn new(spi: Spi, cs: Pin, dc: Pin, rst: Pin) -> Self {
        Self { spi, cs, dc, rst }
    }

    /// Resets the panel as Waveshare's demo does, 100 ms each high, low and high, then sends
    /// `INIT_SEQUENCE`.
    pub fn init(&mut self, delay: &mut impl DelayNs) -> Result<(), Error<Spi::Error, Pin::Error>> {
        for state in [PinState::High, PinState::Low, PinState::High] {
            self.rst.set_state(state).map_err(Error::Pin)?;
            delay.delay_ms(100);
        }
        for &(command, parameters) in INIT_SEQUENCE {
            self.command(command, parameters)?;
        }
        Ok(())
    }

    /// Fills `cell` with an RGB565 color: one CASET/RASET/RAMWR window of 4 × 4 pixels.
    pub fn fill_cell(
        &mut self,
        cell: Pos,
        color: u16,
    ) -> Result<(), Error<Spi::Error, Pin::Error>> {
        if cell.x >= W || cell.y >= W {
            return Err(Error::OutsideGrid(cell));
        }
        self.command(CASET, &pixel_span(cell.x))?;
        self.command(RASET, &pixel_span(cell.y))?;
        let pixels = [color.to_be_bytes(); (CELL_PIXELS * CELL_PIXELS) as usize];
        self.command(RAMWR, pixels.as_flattened())
    }

    /// Sends `command` with DC low, then its parameters with DC high, inside one chip select.
    fn command(
        &mut self,
        command: u8,
        parameters: &[u8],
    ) -> Result<(), Error<Spi::Error, Pin::Error>> {
        self.cs.set_low().map_err(Error::Pin)?;
        self.dc.set_low().map_err(Error::Pin)?;
        self.spi.write(&[command]).map_err(Error::Spi)?;
        self.spi.flush().map_err(Error::Spi)?;
        self.dc.set_high().map_err(Error::Pin)?;
        self.spi.write(parameters).map_err(Error::Spi)?;
        self.spi.flush().map_err(Error::Spi)?;
        self.cs.set_high().map_err(Error::Pin)
    }
}

/// The first and last pixel of cell column or row `index`, as CASET and RASET take them: two
/// big-endian u16.
fn pixel_span(index: u8) -> [u8; 4] {
    let first = u16::from(index) * CELL_PIXELS;
    let [first_high, first_low] = first.to_be_bytes();
    let [last_high, last_low] = (first + CELL_PIXELS - 1).to_be_bytes();
    [first_high, first_low, last_high, last_low]
}
