//! Scenarios for the format vectors (README §6.6). Each case states what the core must return
//! for its bytes, and generation fails if the core disagrees, so a case that stops exercising
//! its rule stops the build of `vectors/`.

pub mod journal;
pub mod level;

use jiro_core::Error;

pub struct Case {
    pub name: String,
    pub input: Vec<u8>,
    pub expect: Result<(), Error>,
}

fn case(name: &str, input: Vec<u8>, expect: Result<(), Error>) -> Case {
    Case {
        name: name.to_string(),
        input,
        expect,
    }
}
