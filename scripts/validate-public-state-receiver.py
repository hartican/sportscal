#!/usr/bin/env python3
"""Local static-stdin boundary controls. No database, network or provider calls."""
import base64
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import stat
import sys
import tempfile
import time
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parent
SHA = "a" * 40
SPEC = importlib.util.spec_from_file_location("public_state_receiver", ROOT / "receive-public-state.py")
RECEIVER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RECEIVER)


def packet(lines):
    body = b"".join(lines)
    part = {"name": "part-00.ndjson", "bytes": len(body), "rows": len(lines),
            "md5": hashlib.md5(body).hexdigest()}
    counts = {"current": 0, "scores": 0, "sources": 0,
              "currentFactSources": 0, "scoreFactSources": 0, "receiptKeys": 0}
    sources = {"current": set(), "scores": set()}
    indexed = []
    for line in lines:
        item = json.loads(line)
        kind, row = item["kind"], item["row"]
        counts[kind] += 1
        if kind in sources:
            sources[kind].add(row["source_id"])
        else:
            counts["receiptKeys"] += row["receipt_key_present"]
        indexed.append(((list(["current", "scores", "sources"]).index(kind),
                         row["source_id"], row.get("fixture_id", "")), hashlib.md5(line).hexdigest()))
    counts["currentFactSources"], counts["scoreFactSources"] = map(len, sources.values())
    manifest = {"schemaVersion": "accepted-public-state.v1", "sourceGitSha": SHA,
                "snapshotAt": "2026-10-27T00:00:00.123456+00:00", "readOnly": True,
                "coherence": "one-select-mvcc-snapshot", "databaseEncoding": "UTF8",
                "reportErrorPresence": "UNVERIFIED", "readerContextAccepted": False,
                "counts": counts, "partBytes": len(body),
                "orderedRowsMd5": hashlib.md5("".join(v for _, v in sorted(indexed)).encode()).hexdigest(),
                "parts": [part] if body else []}
    text = json.dumps(manifest, separators=(",", ":")) + "\n"
    return {"status": "ready", "manifest_text": text,
            "manifest_md5": hashlib.md5(text.encode()).hexdigest(),
            "parts": [{**part, "data_base64": base64.b64encode(body).decode()}] if body else []}


def source_line():
    return b'{"kind":"sources","row":{"source_id":"qa","revision":9007199254740993,"checked_at":"2026-10-27T00:00:00.123456Z","next_due_at":null,"failure_count":0,"receipt_key_present":true,"fixture_observations":{"fixture:qa":{"s":"2026-10-27T00:00:00.123456Z","t":null}}}}\n'


def score_line(payload=b'{"number":1.230000}', key=b'fixture:qa', sql_null=False):
    return b'{"kind":"scores","row":{"source_id":"qa","fixture_id":"' + key + b'","score":' + payload + b',"score_is_sql_null":' + (b'true' if sql_null else b'false') + b',"content_hash":"old","first_completed_at":"2026-10-27T00:00:00.123456Z"}}\n'


def rebind_manifest(value, edit):
    manifest = json.loads(value["manifest_text"])
    edit(manifest)
    value["manifest_text"] = json.dumps(manifest, separators=(",", ":")) + "\n"
    value["manifest_md5"] = hashlib.md5(value["manifest_text"].encode()).hexdigest()


class ReceiverControls(unittest.TestCase):
    def invoke(self, value, output):
        return subprocess.run([sys.executable, str(ROOT / "receive-public-state.py"),
                               "--output", str(output), "--source-sha", SHA,
                               "--deadline", str(time.time() + 15)],
                              input=value if type(value) is bytes else json.dumps(value).encode(), capture_output=True, timeout=20)

    def test_operator_query_has_one_renderable_source_binding(self):
        template = (ROOT / "capture-public-state.sql").read_text()
        marker = "__CAPTURE_SOURCE_SHA__"
        self.assertEqual(template.count(marker), 1)
        rendered = template.replace(marker, SHA)
        self.assertNotIn(marker, rendered)
        self.assertIn("'sourceGitSha', '" + SHA + "'", rendered)

    def test_raw_numbers_times_unicode_and_nulls_survive_actual_stdin(self):
        line = source_line().replace(b'"fixture:qa"', '"fixture:日"'.encode())
        lines = [score_line(), line]
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder).resolve() / "capture"
            result = self.invoke(packet(lines), output)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((output / "part-00.ndjson").read_bytes(), b"".join(lines))
            self.assertEqual((output / "part-00.ndjson").stat().st_mode & 0o777, 0o600)

    def test_json_null_and_sql_null_are_distinct_and_unchanged(self):
        lines = [score_line(b'null', b'a', False), score_line(b'null', b'b', True), source_line()]
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder).resolve() / "capture"
            result = self.invoke(packet(lines), output)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((output / "part-00.ndjson").read_bytes(), b"".join(lines))

    def test_truncation_bad_hash_names_counts_privacy_and_scope_leave_no_output(self):
        cases = []
        value = packet([source_line()]); value["parts"][0]["data_base64"] = value["parts"][0]["data_base64"][:-1]; cases.append(value)
        value = packet([source_line()]); value["manifest_md5"] = "0" * 32; cases.append(value)
        value = packet([source_line()]); rebind_manifest(value, lambda m: m["parts"][0].update(name="../foreign")); cases.append(value)
        value = packet([source_line()]); rebind_manifest(value, lambda m: m["counts"].update(sources=2)); cases.append(value)
        value = packet([source_line()]); rebind_manifest(value, lambda m: m.update(sourceGitSha="b" * 40)); cases.append(value)
        value = packet([source_line()]); rebind_manifest(value, lambda m: m.update(readerContextAccepted=True)); cases.append(value)
        value = packet([source_line()]); rebind_manifest(value, lambda m: m.update(reportErrorPresence=False)); cases.append(value)
        cases.append(packet([score_line(b'{"preferences":{"private":"do not print this"}}')]))
        cases.append(packet([source_line(), source_line()]))
        cases.append(packet([source_line(), score_line()]))
        with tempfile.TemporaryDirectory() as folder:
            for index, value in enumerate(cases):
                with self.subTest(index=index):
                    output = Path(folder).resolve() / str(index)
                    result = self.invoke(value, output)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertFalse(output.exists())
                    self.assertNotIn(b"do not print", result.stderr)

    def test_existing_output_and_symlink_cannot_be_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve(); existing = root / "existing"; existing.mkdir()
            (existing / "foreign").write_text("keep")
            for output in [existing, root / "link"]:
                if output.name == "link": output.symlink_to(existing)
                result = self.invoke(packet([source_line()]), output)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual((existing / "foreign").read_text(), "keep")

    def test_exact_four_mib_decoded_part_and_plus_one(self):
        fixed = len(score_line(b'{"padding":""}'))
        for extra in [0, 1]:
            line = score_line(b'{"padding":"' + b'x' * (RECEIVER.PART - fixed + extra) + b'"}')
            self.assertEqual(len(line), RECEIVER.PART + extra)
            with tempfile.TemporaryDirectory() as folder:
                output = Path(folder).resolve() / "capture"
                result = self.invoke(packet([line]), output)
                self.assertEqual(result.returncode, extra, result.stderr)
                self.assertEqual(output.exists(), extra == 0)
                if not extra: self.assertEqual((output / "part-00.ndjson").read_bytes(), line)

    def test_oversized_declared_whole_or_count_refuses_before_decoding(self):
        value = packet([source_line()])
        rebind_manifest(value, lambda m: m["counts"].update(current=10001))
        with tempfile.TemporaryDirectory() as folder:
            with mock.patch.object(RECEIVER.base64, "b64decode", side_effect=AssertionError("must not decode")):
                with self.assertRaisesRegex(RECEIVER.Refusal, "ROW_BUDGET"):
                    RECEIVER.receive(io.BytesIO(json.dumps(value).encode()), Path(folder).resolve() / "capture", SHA, time.monotonic() + 10)
        value = packet([source_line()])
        def oversized(manifest):
            manifest["parts"] = [{"name": "part-" + str(i).zfill(2) + ".ndjson", "bytes": RECEIVER.PART,
                                  "rows": 1, "md5": "a" * 32} for i in range(10)]
            manifest["partBytes"] = RECEIVER.TOTAL  # manifest still counts; this is over total
        rebind_manifest(value, oversized)
        value["parts"] = [{}] * 10
        with tempfile.TemporaryDirectory() as folder:
            with mock.patch.object(RECEIVER.base64, "b64decode", side_effect=AssertionError("must not decode")):
                with self.assertRaisesRegex(RECEIVER.Refusal, "TOTAL_BUDGET"):
                    RECEIVER.receive(io.BytesIO(json.dumps(value).encode()), Path(folder).resolve() / "capture", SHA, time.monotonic() + 10)

    def test_exact_manifest_limit_and_plus_one(self):
        for extra in [0, 1]:
            value = packet([source_line()]); text = value["manifest_text"]
            value["manifest_text"] = text + " " * (RECEIVER.MANIFEST - len(text.encode()) + extra)
            value["manifest_md5"] = hashlib.md5(value["manifest_text"].encode()).hexdigest()
            with tempfile.TemporaryDirectory() as folder:
                output = Path(folder).resolve() / "capture"
                result = self.invoke(value, output)
                self.assertEqual(result.returncode, extra, result.stderr)
                self.assertEqual(output.exists(), extra == 0)

    def test_truncated_outer_or_missing_part_is_not_partial_acceptance(self):
        with tempfile.TemporaryDirectory() as folder:
            value = packet([source_line()]); truncated = json.dumps(value).encode()[:-9]
            value["parts"] = []
            for i, payload in enumerate([truncated, value]):
                output = Path(folder).resolve() / str(i)
                result = self.invoke(payload, output)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(output.exists())

    def test_receipt_absence_and_explicit_null_are_distinct(self):
        first = source_line().replace(b'"fixture_observations":{"fixture:qa":{"s":"2026-10-27T00:00:00.123456Z","t":null}}', b'"fixture_observations":null').replace(b'"receipt_key_present":true', b'"receipt_key_present":false')
        second = first.replace(b'"source_id":"qa"', b'"source_id":"qb"').replace(b'"receipt_key_present":false', b'"receipt_key_present":true')
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder).resolve() / "capture"
            result = self.invoke(packet([first, second]), output)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((output / "part-00.ndjson").read_bytes(), first + second)

    def test_absent_receipt_cannot_have_nonnull_value_even_with_rebound_hashes(self):
        impossible = source_line().replace(b'"receipt_key_present":true', b'"receipt_key_present":false')
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder).resolve() / "capture"
            result = self.invoke(packet([impossible]), output)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(output.exists())

    def test_expired_deadline_does_not_read_or_create(self):
        class NeverRead:
            def read(self, _): raise AssertionError("expired receiver must not consume")
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(RECEIVER.Refusal, "CAPTURE_DEADLINE"):
                RECEIVER.receive(NeverRead(), Path(folder).resolve() / "capture", SHA, time.monotonic() - 1)

    def test_directory_close_failure_rejects_and_cleans_instead_of_leaving_manifest(self):
        value = json.dumps(packet([source_line()])).encode(); close = RECEIVER.os.close; original_stat = RECEIVER.os.fstat
        fired = False
        def fail_once(fd):
            nonlocal fired
            is_directory = stat.S_ISDIR(original_stat(fd).st_mode)
            close(fd)
            if is_directory and not fired:
                fired = True
                raise OSError("forced final directory close")
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder).resolve() / "capture"
            with mock.patch.object(RECEIVER.os, "close", fail_once):
                with self.assertRaisesRegex(OSError, "forced final directory close"):
                    RECEIVER.receive(io.BytesIO(value), output, SHA, time.monotonic() + 10)
            self.assertFalse(output.exists())

    def test_deadline_exception_during_final_close_rolls_back_and_closes_remaining_handles(self):
        value = json.dumps(packet([source_line()])).encode()
        close, open_file, original_stat = RECEIVER.os.close, RECEIVER.os.open, RECEIVER.os.fstat
        opened = []; fired = False
        def track(*args, **kwargs):
            fd = open_file(*args, **kwargs); opened.append(fd); return fd
        def timeout_once(fd):
            nonlocal fired
            directory = stat.S_ISDIR(original_stat(fd).st_mode)
            close(fd)
            if directory and not fired:
                fired = True
                raise RECEIVER.Refusal("CAPTURE_DEADLINE")
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder).resolve() / "capture"
            try:
                with mock.patch.object(RECEIVER.os, "open", track), mock.patch.object(RECEIVER.os, "close", timeout_once):
                    with self.assertRaisesRegex(RECEIVER.Refusal, "CAPTURE_DEADLINE"):
                        RECEIVER.receive(io.BytesIO(value), output, SHA, time.monotonic() + 10)
                self.assertFalse(output.exists())
                for fd in opened:
                    with self.assertRaises(OSError): original_stat(fd)
            finally:
                for fd in opened:
                    try: close(fd)
                    except OSError: pass

    def test_original_readback_failure_survives_secondary_close_failure(self):
        value = json.dumps(packet([source_line()])).encode(); close = RECEIVER.os.close
        failure = OSError("forced original readback"); fired = False; reading = False
        def close_fail(fd):
            nonlocal fired
            close(fd)
            if reading and not fired: fired = True; raise OSError("secondary close")
        def read_fail(*_):
            nonlocal reading
            reading = True
            raise failure
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder).resolve() / "capture"
            with mock.patch.object(RECEIVER.os, "read", read_fail), mock.patch.object(RECEIVER.os, "close", close_fail):
                with self.assertRaises(OSError) as found:
                    RECEIVER.receive(io.BytesIO(value), output, SHA, time.monotonic() + 10)
                self.assertIs(found.exception, failure)
            self.assertFalse(output.exists())

    def test_first_directory_fstat_failure_closes_owned_descriptors_and_removes_new_folder(self):
        value = json.dumps(packet([source_line()])).encode()
        opened = []; original_open = RECEIVER.os.open; original_stat = RECEIVER.os.fstat; fired = False
        def track(*args, **kwargs):
            fd = original_open(*args, **kwargs); opened.append(fd); return fd
        def fail_once(fd):
            nonlocal fired
            if not fired: fired = True; raise OSError("forced directory stat")
            return original_stat(fd)
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder).resolve() / "capture"
            try:
                with mock.patch.object(RECEIVER.os, "open", track), mock.patch.object(RECEIVER.os, "fstat", fail_once):
                    with self.assertRaisesRegex(OSError, "forced directory stat"):
                        RECEIVER.receive(io.BytesIO(value), output, SHA, time.monotonic() + 10)
                for fd in opened:
                    with self.assertRaises(OSError): original_stat(fd)
                self.assertFalse(output.exists())
            finally:
                for fd in opened:
                    try: RECEIVER.os.close(fd)
                    except OSError: pass

    def test_partial_write_is_removed_and_original_failure_survives(self):
        value = json.dumps(packet([source_line()])).encode(); failure = OSError("forced local write")
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder).resolve() / "capture"
            with mock.patch.object(RECEIVER.os, "write", side_effect=failure):
                with self.assertRaises(OSError) as found:
                    RECEIVER.receive(io.BytesIO(value), output, SHA, time.monotonic() + 10)
            self.assertIs(found.exception, failure)
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
