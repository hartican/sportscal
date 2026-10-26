#!/usr/bin/env python3
"""Static stdin receiver only: no service, SQL, subprocess or credential access."""
import argparse
import base64
import decimal
import hashlib
import json
import math
import os
from pathlib import Path
import re
import signal
import stat
import sys
import time

PART = 4 * 1024 * 1024
TOTAL = 40 * 1024 * 1024
MANIFEST = 64 * 1024
WIRE = 56 * 1024 * 1024
KINDS = ("current", "scores", "sources")
FIELDS = {
    "current": {"source_id", "fixture_id", "identity_keys", "identity_keys_is_sql_null",
                "fixture", "fixture_is_sql_null", "content_hash", "updated_at"},
    "scores": {"source_id", "fixture_id", "score", "score_is_sql_null", "content_hash", "first_completed_at"},
    "sources": {"source_id", "revision", "checked_at", "next_due_at", "failure_count",
                "receipt_key_present", "fixture_observations"},
}
PRIVATE = {"user_id", "userid", "profilehash", "installation_id", "installationid",
           "preferences", "preferencegraph", "entityfollows", "collectionfollows",
           "push_endpoint", "subscription", "credentials", "authorization", "lease_token", "lease_until",
           "access_token", "refresh_token", "api_key", "apikey", "password", "secret", "token", "cookie", "cookies"}


class Refusal(Exception):
    pass


def require(condition, code):
    if not condition:
        raise Refusal(code)


def exact(value, keys):
    require(type(value) is dict and set(value) == set(keys), "PACKET_FIELDS")


def parse(data, raw_numbers=False):
    def pairs(values):
        result = {}
        for key, value in values:
            require(key not in result, "DUPLICATE_JSON_KEY")
            result[key] = value
        return result

    try:
        return json.loads(data.decode("utf-8", "strict"), object_pairs_hook=pairs,
                          parse_int=decimal.Decimal if raw_numbers else int,
                          parse_float=decimal.Decimal,
                          parse_constant=lambda _: (_ for _ in ()).throw(Refusal("JSON_CONSTANT")))
    except Refusal:
        raise
    except (ValueError, UnicodeError, RecursionError):
        raise Refusal("PACKET_JSON") from None


def public(value):
    if type(value) is dict:
        require(not any(key.lower().replace("-", "_") in PRIVATE for key in value), "PRIVATE_FIELD")
        for child in value.values():
            public(child)
    elif type(value) is list:
        for child in value:
            public(child)


def md5(data):
    return hashlib.md5(data).hexdigest()


def signature(value):
    return value.st_dev, value.st_ino, value.st_mode, value.st_nlink, value.st_size, value.st_mtime_ns, value.st_ctime_ns


class Output:
    def __init__(self, destination):
        self.path = Path(destination)
        require(self.path.is_absolute() and self.path.parent.resolve(strict=True) == self.path.parent, "OUTPUT_PATH")
        self.parent = os.open(self.path.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        self.directory = None
        self.identity = None
        self.created = []
        try:
            os.mkdir(self.path.name, 0o700, dir_fd=self.parent)
            self.directory = os.open(self.path.name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=self.parent)
            value = os.fstat(self.directory)
            self.identity = value.st_dev, value.st_ino
        except BaseException:
            if self.directory is not None and self.identity is None:
                try:
                    value = os.fstat(self.directory)  # cleanup-only identity recovery
                    self.identity = value.st_dev, value.st_ino
                except OSError:
                    pass
            try:
                self.close(True)
            except OSError:
                pass
            raise

    def verify(self):
        value = os.stat(self.path.name, dir_fd=self.parent, follow_symlinks=False)
        require(stat.S_ISDIR(value.st_mode) and (value.st_dev, value.st_ino) == self.identity, "OUTPUT_CHANGED")

    def write(self, name, data):
        self.verify()
        fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=self.directory)
        owned = {"name": name, "identity": None}
        self.created.append(owned)
        primary = None
        try:
            value = os.fstat(fd)
            owned["identity"] = value.st_dev, value.st_ino
            require(stat.S_ISREG(value.st_mode) and value.st_nlink == 1, "OUTPUT_CHANGED")
            position = 0
            while position < len(data):
                written = os.write(fd, memoryview(data)[position:])
                require(written > 0, "OUTPUT_WRITE")
                position += written
        except BaseException as error:
            primary = error
            raise
        finally:
            if owned["identity"] is None:
                try:
                    value = os.fstat(fd)  # cleanup identity only; never retry a write
                    owned["identity"] = value.st_dev, value.st_ino
                except OSError:
                    pass
            try:
                os.close(fd)
            except OSError:
                if primary is None:
                    raise

    def readback(self, name, expected_bytes, expected_md5):
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=self.directory)
        primary = None
        try:
            before = os.fstat(fd)
            require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_size == expected_bytes, "READBACK_CHANGED")
            digest, checksum, size = hashlib.sha256(), hashlib.md5(), 0
            while chunk := os.read(fd, 65536):
                size += len(chunk)
                require(size <= expected_bytes, "READBACK_CHANGED")
                digest.update(chunk)
                checksum.update(chunk)
            require(size == expected_bytes and checksum.hexdigest() == expected_md5, "READBACK_HASH")
            require(signature(before) == signature(os.fstat(fd)) == signature(os.stat(name, dir_fd=self.directory, follow_symlinks=False)), "READBACK_CHANGED")
            return digest.hexdigest()
        except BaseException as error:
            primary = error
            raise
        finally:
            try:
                os.close(fd)
            except OSError:
                if primary is None:
                    raise

    def rollback(self):
        directory, reopened = self.directory, False
        try:
            try:
                value = os.fstat(directory) if directory is not None else None
            except OSError:
                value = None
            if value is None:
                directory = os.open(self.path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
                reopened = True
                value = os.fstat(directory)
            require((value.st_dev, value.st_ino) == self.identity, "OUTPUT_CHANGED")
            for item in reversed(self.created):
                try:
                    value = os.stat(item["name"], dir_fd=directory, follow_symlinks=False)
                    if (value.st_dev, value.st_ino) == item["identity"]:
                        os.unlink(item["name"], dir_fd=directory)
                except OSError:
                    pass
            value = os.lstat(self.path)
            if (value.st_dev, value.st_ino) == self.identity:
                os.rmdir(self.path)  # preserves a foreign/nonempty directory
        except (OSError, Refusal):
            pass
        finally:
            if reopened:
                try:
                    os.close(directory)
                except OSError:
                    pass

    def close(self, failed):
        if failed:
            self.rollback()
        errors = []
        for fd in (self.directory, self.parent):
            if fd is not None:
                try:
                    os.close(fd)
                except OSError as error:
                    errors.append(error)
        if errors:
            if not failed:
                self.rollback()
            raise errors[0]


def receive(stream, destination, source_sha, cutoff):
    require(re.fullmatch("[a-f0-9]{40}", source_sha) is not None, "SOURCE_SHA")
    check = lambda: require(time.monotonic() < cutoff, "CAPTURE_DEADLINE")
    check()
    wire = stream.read(WIRE + 1)
    require(len(wire) <= WIRE, "WIRE_BUDGET")
    packet = parse(wire)
    exact(packet, ("status", "manifest_text", "manifest_md5", "parts"))
    require(packet["status"] == "ready", "DATABASE_REFUSED")
    require(type(packet["manifest_text"]) is str, "MANIFEST_FORMAT")
    raw_manifest = packet["manifest_text"].encode("utf-8")
    require(len(raw_manifest) <= MANIFEST and md5(raw_manifest) == packet["manifest_md5"], "MANIFEST_HASH_OR_BUDGET")
    manifest = parse(raw_manifest)
    exact(manifest, ("schemaVersion", "sourceGitSha", "snapshotAt", "readOnly", "coherence", "databaseEncoding",
                     "reportErrorPresence", "readerContextAccepted", "counts", "partBytes", "orderedRowsMd5", "parts"))
    require(manifest["schemaVersion"] == "accepted-public-state.v1" and manifest["sourceGitSha"] == source_sha, "SOURCE_BINDING")
    require(manifest["readOnly"] is True and manifest["coherence"] == "one-select-mvcc-snapshot"
            and manifest["databaseEncoding"] == "UTF8", "SNAPSHOT_BINDING")
    require(type(manifest["snapshotAt"]) is str and re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})", manifest["snapshotAt"]), "SNAPSHOT_CLOCK")
    require(manifest["reportErrorPresence"] == "UNVERIFIED" and manifest["readerContextAccepted"] is False, "ACCEPTANCE_SCOPE")
    counts = manifest["counts"]
    exact(counts, (*KINDS, "currentFactSources", "scoreFactSources", "receiptKeys"))
    require(all(type(n) is int and n >= 0 for n in counts.values()) and counts["current"] <= 10000
            and counts["scores"] <= 10000 and counts["sources"] <= 128, "ROW_BUDGET")
    require(type(manifest["parts"]) is list and type(packet["parts"]) is list
            and len(manifest["parts"]) == len(packet["parts"]) <= 16, "PART_BUDGET")
    names, declared = [], 0
    for descriptor in manifest["parts"]:
        exact(descriptor, ("name", "bytes", "rows", "md5"))
        require(type(descriptor["name"]) is str and re.fullmatch(r"part-(?:0[0-9]|1[0-5])\.ndjson", descriptor["name"]), "PART_NAME")
        require(type(descriptor["bytes"]) is int and 0 < descriptor["bytes"] <= PART
                and type(descriptor["rows"]) is int and descriptor["rows"] > 0, "PART_BUDGET")
        require(type(descriptor["md5"]) is str and re.fullmatch("[a-f0-9]{32}", descriptor["md5"]), "PART_HASH")
        names.append(descriptor["name"])
        declared += descriptor["bytes"]
    require(names == sorted(set(names)), "PART_ORDER")
    require(type(manifest["partBytes"]) is int and declared == manifest["partBytes"]
            and declared + len(raw_manifest) <= TOTAL, "TOTAL_BUDGET")
    check()
    output = Output(destination)
    failed = True
    primary = None
    observed = {key: 0 for key in counts}
    source_sets = {kind: set() for kind in KINDS}
    indexed, hashes = {}, []
    try:
        for descriptor, transport in zip(manifest["parts"], packet["parts"]):
            check()
            exact(transport, ("name", "bytes", "rows", "md5", "data_base64"))
            require({k: transport[k] for k in descriptor} == descriptor and type(transport["data_base64"]) is str, "PART_BINDING")
            require(len(transport["data_base64"]) == 4 * ((descriptor["bytes"] + 2) // 3), "BASE64_BUDGET")
            try:
                data = base64.b64decode(transport["data_base64"], validate=True)
            except (ValueError, UnicodeError):
                raise Refusal("BASE64_FORMAT") from None
            require(len(data) == descriptor["bytes"] and md5(data) == descriptor["md5"], "PART_HASH")
            lines = data.splitlines(keepends=True)
            require(len(lines) == descriptor["rows"], "ROW_COUNT")
            prior = None
            for line in lines:
                require(line.endswith(b"\n") and len(line) <= PART, "ROW_FRAME")
                item = parse(line, raw_numbers=True)
                exact(item, ("kind", "row"))
                kind, row = item["kind"], item["row"]
                require(type(kind) is str and kind in FIELDS, "ROW_KIND")
                exact(row, FIELDS[kind])
                require(type(row["source_id"]) is str and (kind == "sources" or type(row["fixture_id"]) is str), "IDENTITY")
                key = KINDS.index(kind), row["source_id"], row.get("fixture_id", "")
                require(key not in indexed and (prior is None or prior < key), "IDENTITY_OR_ORDER")
                prior = key
                indexed[key] = md5(line)
                observed[kind] += 1
                source_sets[kind].add(row["source_id"])
                if kind == "sources":
                    require(type(row["receipt_key_present"]) is bool, "RECEIPT_PRESENCE")
                    observed["receiptKeys"] += row["receipt_key_present"]
                for flag, field in (("score_is_sql_null", "score"), ("fixture_is_sql_null", "fixture"), ("identity_keys_is_sql_null", "identity_keys")):
                    if flag in row:
                        require(type(row[flag]) is bool and (not row[flag] or row[field] is None), "SQL_NULL_FLAG")
                public(row)
            output.write(descriptor["name"], data)
            hashes.append({"name": descriptor["name"], "bytes": len(data), "sha256": output.readback(descriptor["name"], len(data), descriptor["md5"])})
        observed["currentFactSources"], observed["scoreFactSources"] = len(source_sets["current"]), len(source_sets["scores"])
        require(observed == counts, "GRAPH_COUNTS")
        require(md5("".join(indexed[key] for key in sorted(indexed)).encode()) == manifest["orderedRowsMd5"], "GRAPH_HASH")
        # Recheck the complete saved set after later parts have been written.
        for descriptor, saved in zip(manifest["parts"], hashes):
            check()
            require(output.readback(descriptor["name"], descriptor["bytes"], descriptor["md5"]) == saved["sha256"], "READBACK_CHANGED")
        check()
        output.write("manifest.json", raw_manifest)
        manifest_sha = output.readback("manifest.json", len(raw_manifest), packet["manifest_md5"])
        output.verify()
        require(set(os.listdir(output.directory)) == set(names) | {"manifest.json"}, "OUTPUT_NAMESPACE")
        check()
        failed = False
        return {"state": "validated-public-reference-only", "sourceGitSha": source_sha, "counts": observed,
                "decodedBytes": declared + len(raw_manifest), "manifestSha256": manifest_sha, "files": hashes,
                "reportErrorPresence": "UNVERIFIED", "readerContextAccepted": False,
                "wholeToolDeliveryQualified": False, "networkRequests": 0}
    except BaseException as error:
        primary = error
        raise
    finally:
        try:
            output.close(failed)
        except OSError:
            if primary is None:
                raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    parser.add_argument("--source-sha", required=True)
    parser.add_argument("--deadline", required=True, type=float, help="ROOT's absolute epoch deadline, set before its SQL request")
    args = parser.parse_args()
    remaining = args.deadline - time.time()
    require(math.isfinite(remaining) and 0 < remaining <= 60, "CAPTURE_DEADLINE")
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(Refusal("CAPTURE_DEADLINE")))
    signal.setitimer(signal.ITIMER_REAL, remaining)
    try:
        result = receive(sys.stdin.buffer, args.output, args.source_sha, time.monotonic() + remaining)
        print(json.dumps(result, separators=(",", ":")))
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error) if isinstance(error, Refusal) else "RECEIVER_FAILURE", file=sys.stderr)
        sys.exit(1)
