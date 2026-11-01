"""Writes the natmod config header that `mpy_ld.py --preprocess` would write, without running
MicroPython's tools: static qstrs numbered from 1 in the order of py/makeqstrdata.py's
static_qstr_list (read as a literal), then the module's own qstrs as mp_native_qstr_table
entries, sorted. Only identifier-shaped static qstrs are written (the others are escaped by
mpy_ld and unused here); their numbers keep their list positions.

Usage: python3 -I make_config_h.py <micropython> <out.h> <source.c>...
"""

import ast
import re
import sys
from pathlib import Path


def static_qstrs(micropython):
    text = (Path(micropython) / "py" / "makeqstrdata.py").read_text()
    start = text.index("static_qstr_list = [") + len("static_qstr_list = ")
    end = text.index("]", start) + 1
    return ast.literal_eval(text[start:end])


def main(micropython, out, sources):
    static = static_qstrs(micropython)
    used = set()
    for source in sources:
        used.update(re.findall(r"MP_QSTR_([A-Za-z0-9_]*)", Path(source).read_text()))
    lines = ["#include <stdint.h>", "typedef uintptr_t mp_off_t;"]
    for i, q in enumerate(static):
        if re.fullmatch(r"[A-Za-z0-9_]+", q):
            lines.append(f"#define MP_QSTR_{q} ({i + 1})")
    for i, q in enumerate(sorted(used - set(static))):
        lines.append(f"#define MP_QSTR_{q} (mp_native_qstr_table[{i + 1}])")
    lines += [
        "extern const uint16_t mp_native_qstr_table[];",
        "extern const uintptr_t mp_native_obj_table[];",
    ]
    Path(out).write_text("\n".join(lines) + "\n")
    print(f"{out}: {len(static)} static qstrs, native: {sorted(used - set(static))}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3:])
