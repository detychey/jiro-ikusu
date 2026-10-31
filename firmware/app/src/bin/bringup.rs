//! Bring-up of the display and the inputs: a blue border, a black interior and one indicator per
//! input, 9 in all, placed as Waveshare's demo places them, next to their controls: the
//! joystick's cross on the left with the press at its centre, and A, B, X, Y down the right. A
//! mask input lights green from the input mask; Y and the press, which the mask never reads,
//! light yellow from their own pins.

#![no_std]
#![no_main]

use core::convert::Infallible;

use embassy_executor::Spawner;
use embassy_rp::Peri;
use embassy_rp::gpio::{AnyPin, Input, Level, Output, Pin, Pull};
use embassy_rp::peripherals::SPI1;
use embassy_rp::spi::{self, Blocking, Spi};
use embassy_time::{Delay, Duration, Ticker};
use jiro_core::consts::TICK_HZ;
use jiro_core::types::{CellIndex, Pos};
use jiro_firmware_drivers::input::{MASK_PINS, read_mask};
use jiro_firmware_drivers::st7789::{self, St7789};
use panic_halt as _;

type Display = St7789<Spi<'static, SPI1, Blocking>, Output<'static>>;
type DisplayError = st7789::Error<spi::Error, Infallible>;
type MaskInputs = [Input<'static>; MASK_PINS.len()];

/// The RP2040's fastest SPI clock, clk_peri / 2. Waveshare's MicroPython demo asks for 100 MHz,
/// which the RP2040 caps at this rate.
const SPI_HZ: u32 = 62_500_000;

const BLUE: u16 = 0x001F;
const BLACK: u16 = 0x0000;
const DARK_GRAY: u16 = 0x4208;
const GREEN: u16 = 0x07E0;
const YELLOW: u16 = 0xFFE0;

const INDICATOR_CELLS: u8 = 6;

/// The top-left cell of each indicator: the mask inputs in `MASK_PINS` order (up, down, left,
/// right, A, B, X), then Y and the joystick press.
const INDICATORS: [Pos; MASK_PINS.len() + 2] = [
    Pos { x: 16, y: 16 },
    Pos { x: 16, y: 38 },
    Pos { x: 5, y: 27 },
    Pos { x: 27, y: 27 },
    Pos { x: 50, y: 5 },
    Pos { x: 50, y: 20 },
    Pos { x: 50, y: 35 },
    Pos { x: 50, y: 50 },
    Pos { x: 16, y: 27 },
];

#[embassy_executor::main]
async fn main(_spawner: Spawner) {
    let p = embassy_rp::init(Default::default());

    let mut config = spi::Config::default();
    config.frequency = SPI_HZ;
    let display = St7789::new(
        Spi::new_blocking_txonly(p.SPI1, p.PIN_10, p.PIN_11, config),
        Output::new(p.PIN_9, Level::High),
        Output::new(p.PIN_8, Level::High),
        Output::new(p.PIN_12, Level::High),
    );
    let _backlight = Output::new(p.PIN_13, Level::High);

    let mask_pins: [Peri<'static, AnyPin>; MASK_PINS.len()] = [
        p.PIN_2.into(),
        p.PIN_18.into(),
        p.PIN_16.into(),
        p.PIN_20.into(),
        p.PIN_15.into(),
        p.PIN_17.into(),
        p.PIN_19.into(),
    ];
    assert!(
        mask_pins
            .iter()
            .map(|pin| pin.pin())
            .eq(MASK_PINS.map(|(gpio, _)| gpio))
    );
    let mask_inputs = mask_pins.map(|pin| Input::new(pin, Pull::Up));
    let y = Input::new(p.PIN_21, Pull::Up);
    let press = Input::new(p.PIN_3, Pull::Up);

    let Err(error) = run(display, mask_inputs, y, press).await;
    panic!("display: {error:?}");
}

async fn run(
    mut display: Display,
    mut mask_inputs: MaskInputs,
    y: Input<'static>,
    press: Input<'static>,
) -> Result<Infallible, DisplayError> {
    display.init(&mut Delay)?;
    for cell in CellIndex::all() {
        let pos = cell.pos();
        display.fill_cell(pos, if pos.is_border() { BLUE } else { BLACK })?;
    }
    for corner in INDICATORS {
        fill_indicator(&mut display, corner, DARK_GRAY)?;
    }

    let mut shown = [false; INDICATORS.len()];
    let mut ticker = Ticker::every(Duration::from_hz(TICK_HZ.into()));
    loop {
        let Ok(mask) = read_mask(&mut mask_inputs);
        let inputs = MASK_PINS
            .iter()
            .map(|&(_, input)| (mask.contains(input), GREEN))
            .chain([(y.is_low(), YELLOW), (press.is_low(), YELLOW)]);
        for ((&corner, (pressed, lit)), shown) in INDICATORS.iter().zip(inputs).zip(&mut shown) {
            if pressed != *shown {
                fill_indicator(&mut display, corner, if pressed { lit } else { DARK_GRAY })?;
                *shown = pressed;
            }
        }
        ticker.next().await;
    }
}

fn fill_indicator(display: &mut Display, corner: Pos, color: u16) -> Result<(), DisplayError> {
    for y in corner.y..corner.y + INDICATOR_CELLS {
        for x in corner.x..corner.x + INDICATOR_CELLS {
            display.fill_cell(Pos { x, y }, color)?;
        }
    }
    Ok(())
}
