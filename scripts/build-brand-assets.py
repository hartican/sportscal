#!/usr/bin/env python3
"""Build the current SportsYurt v4 deployment assets."""
from pathlib import Path
import runpy

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).with_name("build-sportsyurt-brand.py")), run_name="__main__")
