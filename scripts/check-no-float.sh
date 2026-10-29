#!/usr/bin/env bash
# Fails on floating point in consensus code, two ways:
# - tokens: an f32 or f64 token in core/src or shell/src, the literal suffixes
#   (0.5f32, 2.0_f64) included;
# - symbols: an undefined soft-float symbol in the archive members of the float probe's
#   own crates, built for thumbv6m-none-eabi and riscv32im-unknown-none-elf: __aeabi_f*,
#   __aeabi_d*, the __aeabi_*2f/*2d conversions, the __*sf*/__*df* family, and the
#   fmax*/fmin*/fmod* calls that max, min and % lower to. The crates come from the
#   probe's dependency tree; core, compiler_builtins and compiler-rt members always carry
#   soft-float references and are not scanned. The probe is built with
#   -C link-dead-code, so a function nothing calls is compiled and scanned too; a
#   generic function is scanned once something instantiates it.
# CHECK_TOKENS=0 skips the token check, to show the symbol check alone.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
readonly PROBE=scripts/float-probe
readonly TARGETS="thumbv6m-none-eabi riscv32im-unknown-none-elf"
readonly SOFT_FLOAT='^(__aeabi_[fd][a-z0-9_]*|__aeabi_[a-z]+2[fd]|__[a-z0-9_]*[sd]f[a-z0-9_]*|f(max|min)(imum)?(_num)?f?|fmodf?)$'
readonly FLOAT_TOKEN='(^|[^A-Za-z0-9_])([0-9][0-9_.eE+-]*)?f(32|64)([^A-Za-z0-9_]|$)'

found=0

if [ "${CHECK_TOKENS:-1}" != 0 ]; then
  for dir in core/src shell/src; do
    [ -d "$dir" ] || { echo "check-no-float: $dir not found"; exit 2; }
  done
  if grep -rnE "$FLOAT_TOKEN" core/src shell/src; then
    echo "check-no-float: float tokens above"
    found=1
  fi
fi

host="$(rustc -vV | sed -n 's/^host: //p')"
llvm_bin="$(rustc --print sysroot)/lib/rustlib/$host/bin"
[ -x "$llvm_bin/llvm-nm" ] || { echo "check-no-float: llvm-nm missing; install the llvm-tools component"; exit 2; }

for target in $TARGETS; do
  crates="$(cd "$PROBE" && cargo tree --locked -e normal --prefix none --format '{lib}' --target "$target" | sort -u)"
  [ -n "$crates" ] || { echo "check-no-float: no crates in the probe's dependency tree"; exit 2; }
  member_pattern="^($(echo $crates | tr ' ' '|'))-"

  RUSTFLAGS="-C link-dead-code" cargo build --manifest-path "$PROBE/Cargo.toml" \
    --target-dir "$PROBE/target" --release --locked --quiet --target "$target"
  archive="$PROBE/target/$target/release/libfloat_probe.a"

  members="$("$llvm_bin/llvm-ar" t "$archive" | grep -E "$member_pattern" || true)"
  echo "$target: scanned members:"
  printf '  %s\n' $members

  soft_float="$("$llvm_bin/llvm-nm" -A --undefined-only "$archive" |
    awk -v members="$member_pattern" -v symbols="$SOFT_FLOAT" '{
      member = $1; sub(/^.*\.a:/, "", member); sub(/:$/, "", member)
      if (member ~ members && $NF ~ symbols) print member ": " $NF
    }')"
  if [ -n "$soft_float" ]; then
    echo "$target: soft-float references:"
    sed 's/^/  /' <<<"$soft_float"
    found=1
  fi
done

exit "$found"
