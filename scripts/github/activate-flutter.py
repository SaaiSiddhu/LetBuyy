#!/usr/bin/env python3
"""Use an existing, version-bound self-hosted SDK without downloading or changing it."""
import argparse
import json
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", required=True)
    args = parser.parse_args()
    value = os.environ.get("LETBUYY_CI_FLUTTER_ROOT", "")
    if not value or "\n" in value or "\r" in value or not Path(value).is_absolute():
        raise ValueError("An absolute existing Flutter SDK path is required")
    root = Path(value).resolve(strict=True)
    metadata = json.loads((root / "bin/cache/flutter.version.json").read_text())
    if metadata.get("frameworkVersion") != args.version:
        raise ValueError("Installed Flutter version differs from the CI version")
    for binary in (root / "bin/flutter", root / "bin/cache/dart-sdk/bin/dart"):
        if not binary.is_file() or not os.access(binary, os.X_OK):
            raise ValueError("The existing SDK is incomplete")
    # Validate all inputs before adding anything to the next step's environment.
    path_file = Path(os.environ["GITHUB_PATH"])
    env_file = Path(os.environ["GITHUB_ENV"])
    if not path_file.is_file() or not env_file.is_file():
        raise ValueError("GitHub environment files are unavailable")
    with path_file.open("a") as output:
        output.write(str(root / "bin") + "\n")
    with env_file.open("a") as output:
        output.write("FLUTTER_ROOT=" + str(root) + "\n")
    print("Using existing Flutter " + args.version + "; SDK preserved")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        raise SystemExit("Existing Flutter SDK admission refused: " + str(error))
