#!/usr/bin/env bash
# Builds jiro-core (path dependency on the repository's core, read-only) through the no_std
# wrapper natmod/rust for thumbv6m-none-eabi with -C relocation-model=pic, then partially links
# the staticlib into one relocatable object, keeping only what the exported entry points reach
# (mpy_ld has no section garbage collection), and strips debug, unwind-index and bitcode sections.
# Output: build/jiro_rust.o, the object that both the natmod and the Cortex-M0 harness link.
set -euo pipefail
S=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$S/build"
(cd "$S/natmod/rust" && cargo build --release --offline --locked 2>&1 | tail -3)
LIB=$S/natmod/rust/target/thumbv6m-none-eabi/release/libjiro_natmod.a
ROOTS="jiro_rules_version jiro_replay jiro_recorder_size jiro_recorder_align jiro_recorder_start jiro_recorder_step jiro_recorder_view"
arm-none-eabi-ld -r --gc-sections $(for s in $ROOTS; do printf -- '-u %s ' "$s"; done) \
  -o "$S/build/jiro_rust.full.o" "$LIB"
arm-none-eabi-objcopy --strip-debug --remove-section='.ARM.exidx*' --remove-section=.llvmbc \
  --remove-section=.llvmcmd --remove-section=.comment "$S/build/jiro_rust.full.o" "$S/build/jiro_rust.o"
rm "$S/build/jiro_rust.full.o"
arm-none-eabi-size "$S/build/jiro_rust.o"
