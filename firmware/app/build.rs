//! Puts memory.x on the linker's search path, and has the linker write each binary's map next to
//! the binary, as `<bin>.map`, for scripts/check-fw-mem.sh.

use std::env;
use std::path::PathBuf;

const BINS: [&str; 1] = ["bringup"];

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").expect("cargo sets CARGO_MANIFEST_DIR");
    println!("cargo:rustc-link-search={manifest_dir}");
    println!("cargo:rerun-if-changed=memory.x");

    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("cargo sets OUT_DIR"));
    let profile_dir = out_dir
        .ancestors()
        .nth(3)
        .expect("OUT_DIR is <target>/<triple>/<profile>/build/<package>-<hash>/out");
    for bin in BINS {
        let map = profile_dir.join(format!("{bin}.map"));
        println!("cargo:rustc-link-arg-bin={bin}=-Map={}", map.display());
    }
}
