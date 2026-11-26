# Unit tests of gpu_bench.py, M5.9's GPU benchmark: python3 -B -m unittest discover -s referee/zk -p 'test_*.py'
import contextlib
import hashlib
import io
import json
import math
import tempfile
import unittest
from pathlib import Path

import gpu_bench

SEGMENTS = {"small": 7, "run1": 13, "mid": 45, "high": 96, "heaviest": 131, "overcap": 177}
EXPECTED = gpu_bench.read_json(gpu_bench.PROOF_OF_RECORD)
RUN_1_SHA256 = "0x" + hashlib.sha256(bytes.fromhex(EXPECTED["publicValues"][2:])).hexdigest()
MACHINE = """=== BEGIN gpu-measure ===
session: 1
commit: 4ef641c89825b4a4f8565599794fbe623aba2eab
gpu name: NVIDIA GeForce RTX 4090
gpu uuid: GPU-0
gpu memory.total: 24564
gpu power.limit: 450.00
gpu power.default_limit: 450.00
memory: 65000000 kB
cgroup memory.max: max
set-up and build: 2400 s
=== END gpu-measure ===
"""


def wall_of(name):
    """15 s, then 2 s per segment of 2^20 cycles: time follows the proving cycles at any segment size."""
    return 15.0 + 2.0 * SEGMENTS[name]


def entry(proof_id, **fields):
    name, po2, role, round_number = gpu_bench.parse_id(proof_id)
    segments = math.ceil(SEGMENTS[name] * 2 ** (20 - po2))
    return {
        "id": proof_id, "input": name, "po2": po2, "role": role, "round": round_number, "session": 1, "exit": 0,
        "status": "ok", "error": "", "image_id": EXPECTED["imageId"], "segments": segments, "total_cycles": segments * 2**po2,
        "segment_proofs_s": 1.5 * segments, "recursion_s": 0.4 * segments, "groth16_s": 9.0, "total_s": 9.0 + 1.9 * segments,
        "wall_s": wall_of(name), "vmhwm_kib": 9_000_000, "seal_bytes": 260, "selector": EXPECTED["seal"][:10],
        "public_values_sha256": RUN_1_SHA256 if name == "run1" else f"0x{name}", "gpu_peak_mib": 12_000, "gpu_before_mib": 1,
        "samples": 30, "slowdown_samples": 0, "sm_clock_busy_median_mhz": 2700, "temperature_max_c": 70, "clock_event_reasons": "0x0",
    } | fields


def complete_benchmark():
    """Every proof of a first session's plan, each on the line wall = 15 s + 2 s x segments."""
    with tempfile.TemporaryDirectory() as out:
        (Path(out) / "machine-s1.txt").write_text(MACHINE)
        return [entry(proof_id) for proof_id in gpu_bench.plan(out, 20, 3, [])]


def prove_log(segments=13, image_id=EXPECTED["imageId"], seal_bytes=260, sha256=RUN_1_SHA256, verified=True):
    return f"""=== BEGIN zk-prove ===
mode: run
image id: {image_id}
segment limit: 2^20 (default)
segments: {segments}, total cycles: {segments * 2**20}, user cycles: 12000000, paging cycles: 600000
segment proofs: 20.5 s
recursion to one succinct receipt: 5.2 s
Groth16 wrapping: 9.1 s
total: 34.8 s
peak RSS of this process (VmHWM): 9601376 kB
seal: {seal_bytes} bytes, selector {EXPECTED["seal"][:10]}
public values: 2304 bytes, sha256 {sha256}
{"verified: yes" if verified else ""}
=== END zk-prove ===
=== BEGIN zk-fixture ===
{{"mode":"run"}}
=== END zk-fixture ===
=== BEGIN peak-memory ===
exit status: 0
wall time: 41.3 s
peak RSS, command tree: 9400 MiB
peak GPU memory in use, every process: 14200 MiB (1 MiB before the command)
=== END peak-memory ===
"""


class BenchDirectory(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.out = Path(directory.name)
        (self.out / "proofs").mkdir()
        (self.out / "machine-s1.txt").write_text(MACHINE)

    def write_records(self, records):
        (self.out / "results.jsonl").write_text("".join(json.dumps(record) + "\n" for record in records))

    def summarize(self, po2=20):
        with contextlib.redirect_stdout(io.StringIO()):
            status = gpu_bench.summary(self.out, po2, 0.34, 1700.0, 0.02)
        rows = [line.split(" | ") for line in (self.out / "summary.md").read_text().splitlines() if line.startswith("| A")]
        return status, {row[0][2:]: row[2] for row in rows}

    def record(self, proof_id, exit_status, log="", err="", csv=""):
        for suffix, text in ((".log", log), (".err", err), (".gpu.csv", csv)):
            (self.out / "proofs" / f"{proof_id}{suffix}").write_text(text)
        with contextlib.redirect_stdout(io.StringIO()):
            return gpu_bench.record(self.out, proof_id, exit_status, [])


class PlanTest(BenchDirectory):
    def test_a_fresh_plan_starts_with_a_cold_proof_and_ends_with_the_sentinel(self):
        plan = gpu_bench.plan(self.out, 20, 3, [])
        self.assertEqual((plan[0], plan[-1]), ("small-p20-cold1", "small-p20-sentinel1"))

    def test_a_fresh_plan_has_three_rounds_of_six_and_four_sweep_proofs(self):
        self.assertEqual(len(gpu_bench.plan(self.out, 20, 3, [])), 1 + 18 + 4 + 1)

    def test_the_second_round_runs_from_the_largest_input(self):
        plan = gpu_bench.plan(self.out, 20, 3, [])
        self.assertEqual(plan[7:13], [f"{name}-p20-r2" for name in reversed(SEGMENTS)])

    def test_the_sweep_goes_one_size_down_then_one_up(self):
        plan = gpu_bench.plan(self.out, 20, 3, [])
        self.assertEqual(plan[19:23], ["run1-p19-sweep", "heaviest-p19-sweep", "run1-p21-sweep", "heaviest-p21-sweep"])

    def test_the_sweep_stops_at_2_21(self):
        sweep = [proof_id for proof_id in gpu_bench.plan(self.out, 21, 1, []) if "sweep" in proof_id]
        self.assertEqual(sweep, ["run1-p20-sweep", "heaviest-p20-sweep"])

    def test_recorded_proofs_are_skipped(self):
        self.write_records([entry("small-p20-r1")])
        self.assertNotIn("small-p20-r1", gpu_bench.plan(self.out, 20, 3, []))

    def test_a_failed_proof_is_a_result_and_is_skipped_too(self):
        self.write_records([entry("run1-p21-sweep", status="oom-gpu")])
        self.assertNotIn("run1-p21-sweep", gpu_bench.plan(self.out, 20, 3, []))

    def test_nothing_is_planned_once_every_proof_is_recorded(self):
        self.write_records(complete_benchmark())
        self.assertEqual(gpu_bench.plan(self.out, 20, 3, []), [])

    def test_redo_plans_an_input_again(self):
        self.write_records(complete_benchmark())
        self.assertEqual(gpu_bench.plan(self.out, 20, 3, ["mid"])[1:-1], ["mid-p20-r1", "mid-p20-r2", "mid-p20-r3"])

    def test_run_1_is_proven_from_its_run_file_and_season(self):
        self.assertEqual(
            gpu_bench.prove_args("run1-p19-sweep"),
            ["--run", "seasons/testnet-0/runs/run-1.json", "--season", "seasons/testnet-0.json", "--segment-po2", "19"],
        )

    def test_every_vector_input_is_six_committed_files(self):
        for files in (files for files in gpu_bench.INPUTS.values() if "--season" not in files):
            self.assertEqual([len(files), all((gpu_bench.REPO_ROOT / file).is_file() for file in files)], [6, True])

    def test_an_unknown_input_is_not_a_proof_id(self):
        with self.assertRaises(ValueError):
            gpu_bench.parse_id("tiny-p20-r1")


class RecordTest(BenchDirectory):
    def test_a_verified_proof_is_ok(self):
        self.assertEqual(self.record("run1-p20-r1", 0, log=prove_log())["status"], "ok")

    def test_a_proof_record_holds_its_phases_and_wall_time(self):
        record = self.record("run1-p20-r1", 0, log=prove_log())
        self.assertEqual(
            [record[field] for field in ("segments", "segment_proofs_s", "recursion_s", "groth16_s", "wall_s", "vmhwm_kib", "gpu_before_mib")],
            [13, 20.5, 5.2, 9.1, 41.3, 9601376, 1],
        )

    def test_a_record_is_appended_to_the_results(self):
        self.record("run1-p20-r1", 0, log=prove_log())
        self.assertEqual([record["id"] for record in gpu_bench.read_records(self.out)], ["run1-p20-r1"])

    def test_the_card_out_of_memory_is_oom_gpu(self):
        err = "thread 'main' panicked at risc0-zkp: CUDA_ERROR_OUT_OF_MEMORY: out of memory\n"
        self.assertEqual(self.record("heaviest-p21-sweep", 134, err=err)["status"], "oom-gpu")

    def test_a_killed_prover_is_oom_host(self):
        self.assertEqual(self.record("heaviest-p21-sweep", 137)["status"], "oom-host")

    def test_a_receipt_that_does_not_verify_is_a_verify_failure(self):
        err = "zk-host: the Groth16 receipt does not verify: verification indicates proof is invalid\n"
        self.assertEqual(self.record("mid-p20-r1", 1, err=err)["status"], "verify-fail")

    def test_public_values_other_than_the_vectors_are_a_verify_failure(self):
        err = 'zk-host: "level 2": outcome.levelScore 12, expected 13\n'
        self.assertEqual(self.record("run1-p20-r1", 1, err=err)["status"], "verify-fail")

    def test_another_image_id_with_exit_status_0_is_a_verify_failure(self):
        record = self.record("run1-p20-r1", 0, log=prove_log(image_id="0x" + "11" * 32))
        self.assertEqual(record["status"], "verify-fail")

    def test_a_seal_of_another_length_is_a_verify_failure(self):
        self.assertEqual(self.record("run1-p20-r1", 0, log=prove_log(seal_bytes=36))["status"], "verify-fail")

    def test_a_guest_out_of_memory_is_an_error_not_the_card(self):
        self.assertEqual(self.record("mid-p20-r1", 1, err="zk-host: execution failed: Guest panicked: Out of memory!\n")["status"], "error")

    def test_an_error_keeps_zk_host_s_message(self):
        record = self.record("mid-p20-r1", 1, err="noise\nzk-host: Groth16 wrapping failed: missing component\nmore\n")
        self.assertEqual(record["error"], "zk-host: Groth16 wrapping failed: missing component")

    def test_telemetry_counts_the_samples_slowed_down(self):
        csv = "t, 2700, 60, 400.1, 99, 15000, 0x0000000000000000\nt, 2500, 85, 450.0, 99, 15000, 0x0000000000000020\n"
        self.assertEqual(gpu_bench.telemetry(csv)["slowdown_samples"], 1)

    def test_telemetry_skips_and_counts_a_cut_line(self):
        csv = "t, 2700, 60, 400.1, 99, 15000, 0x0000000000000000\nt, 2700, 6\n"
        self.assertEqual([gpu_bench.telemetry(csv)[field] for field in ("samples", "malformed_samples")], [1, 1])

    def test_the_clock_is_the_median_while_the_card_is_busy(self):
        csv = "t, 210, 40, 30, 0, 500, 0x1\nt, 2700, 60, 400, 99, 15000, 0x0\nt, 2690, 61, 400, 98, 15000, 0x0\n"
        self.assertEqual(gpu_bench.telemetry(csv)["sm_clock_busy_median_mhz"], 2695)


class FitTest(unittest.TestCase):
    def test_an_exact_line_gives_its_intercept_slope_and_r2_of_1(self):
        intercept, slope, r2 = gpu_bench.fit([(7, 29.0), (13, 41.0), (131, 277.0)])
        self.assertEqual([round(intercept, 9), round(slope, 9), round(r2, 9)], [15.0, 2.0, 1.0])


class SummaryTest(BenchDirectory):
    def test_a_complete_linear_benchmark_passes_every_criterion_but_the_onchain_one(self):
        self.write_records(complete_benchmark())
        status, verdicts = self.summarize()
        self.assertEqual((status, verdicts), (0, {**{f"A{n}": "PASS" for n in range(1, 9)}, "A3": "PENDING"}))

    def test_two_public_values_for_one_input_fail_loudly(self):
        self.write_records(complete_benchmark() + [entry("mid-p20-r2", public_values_sha256="0xother")])
        status, verdicts = self.summarize()
        self.assertEqual((status, verdicts["A2"], "LOUD" in (self.out / "summary.md").read_text()), (1, "FAIL", True))

    def test_run_1_unlike_the_cpu_proof_of_record_fails_loudly(self):
        records = [entry(record["id"], public_values_sha256="0xother") if record["input"] == "run1" else record for record in complete_benchmark()]
        self.write_records(records)
        self.assertEqual(self.summarize()[1]["A2"], "FAIL")

    def test_a_verify_failure_fails_loudly(self):
        self.write_records(complete_benchmark() + [entry("small-p20-sentinel2", status="verify-fail", error="zk-host: does not verify")])
        self.assertEqual(self.summarize(), (1, {**{f"A{n}": "PASS" for n in range(1, 9)}, "A2": "FAIL", "A3": "PENDING"}))

    def test_another_image_id_fails_a1(self):
        self.write_records(complete_benchmark() + [entry("small-p20-r1", image_id="0x" + "11" * 32)])
        self.assertEqual(self.summarize()[1]["A1"], "FAIL")

    def test_the_newest_record_of_a_proof_is_the_one_that_counts(self):
        self.write_records(complete_benchmark() + [entry("mid-p20-r2", status="error"), entry("mid-p20-r2")])
        self.assertEqual(self.summarize()[0], 0)

    def test_an_out_of_memory_at_the_next_size_is_a_result(self):
        self.write_records(complete_benchmark() + [entry("heaviest-p21-sweep", status="oom-gpu", error="zk-host: out of memory")])
        self.assertEqual(self.summarize()[0], 0)

    def test_a_wide_spread_fails_a4(self):
        self.write_records(complete_benchmark() + [entry("high-p20-r3", wall_s=wall_of("high") * 1.2)])
        self.assertEqual(self.summarize()[1]["A4"], "FAIL")

    def test_a_slowed_down_proof_fails_a5(self):
        self.write_records(complete_benchmark() + [entry("high-p20-r3", slowdown_samples=4, clock_event_reasons="0x40")])
        self.assertEqual(self.summarize()[1]["A5"], "FAIL")

    def test_a_card_in_use_before_a_proof_fails_a5(self):
        self.write_records(complete_benchmark() + [entry("high-p20-r3", gpu_before_mib=3000)])
        self.assertEqual(self.summarize()[1]["A5"], "FAIL")

    def write_curve(self):
        """Every proof at 2^20 on wall = 15 s + 0.02 s x segments²."""
        self.write_records(
            [entry(record["id"], wall_s=15 + 0.02 * SEGMENTS[record["input"]] ** 2) if record["po2"] == 20 else record for record in complete_benchmark()]
        )

    def test_a_curve_fails_a6(self):
        self.write_curve()
        self.assertEqual(self.summarize()[1]["A6"], "FAIL")

    def test_a_curve_prices_nothing_beyond_the_measured_range(self):
        self.write_curve()
        self.summarize()
        row = next(line for line in (self.out / "summary.md").read_text().splitlines() if line.startswith("| cost-maximising"))
        self.assertEqual(row.split(" | ")[3], "—")

    def test_two_rounds_are_too_few_for_a7(self):
        self.write_records([record for record in complete_benchmark() if record["round"] != 3])
        self.assertEqual(self.summarize()[1]["A7"], "FAIL")

    def test_a_slow_sentinel_fails_a8(self):
        self.write_records(complete_benchmark() + [entry("small-p20-sentinel1", wall_s=wall_of("small") * 1.3)])
        self.assertEqual(self.summarize()[1]["A8"], "FAIL")

    def test_the_onchain_list_starts_with_run_1_and_its_settled_score(self):
        self.write_records(complete_benchmark())
        self.summarize()
        first = (self.out / "onchain.txt").read_text().splitlines()[0]
        self.assertEqual(first, "run1-p20-r1 20310 --run seasons/testnet-0/runs/run-1.json --season seasons/testnet-0.json")

    def test_the_onchain_list_gives_vectors_their_summed_level_scores(self):
        self.write_records(complete_benchmark())
        self.summarize()
        line = next(line for line in (self.out / "onchain.txt").read_text().splitlines() if line.startswith("overcap-p20-r1 "))
        score = gpu_bench.read_json(gpu_bench.REPO_ROOT / "vectors/levels/10-worst.json")["outcome"]["levelScore"] * 6
        self.assertEqual(line.split()[:3], ["overcap-p20-r1", str(score), "--vectors"])

    def test_the_next_segment_size_is_kept_when_it_fits_and_is_faster(self):
        self.write_records(complete_benchmark()[:-1] + [entry("heaviest-p21-sweep", wall_s=0.8 * wall_of("heaviest")), complete_benchmark()[-1]])
        self.summarize()
        self.assertIn("Segment size: use 2^21", (self.out / "summary.md").read_text())

    def test_the_next_segment_size_is_refused_when_it_is_not_faster(self):
        self.write_records(complete_benchmark())
        self.summarize()
        self.assertIn("Segment size: stay at 2^20", (self.out / "summary.md").read_text())

    def test_the_build_time_of_an_earlier_log_counts(self):
        (self.out / "previous").mkdir()
        (self.out / "previous" / "20261126T100000Z-gpu-run-1.log").write_text("set-up and build: 2950 s\n")
        self.assertEqual(gpu_bench.build_seconds(self.out), 2950)


if __name__ == "__main__":
    unittest.main()
