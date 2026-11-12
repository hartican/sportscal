#!/usr/bin/env python3
"""Derive deployment assets from supplied v4 artwork without redrawing it."""
from pathlib import Path
from shutil import copyfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/brand/source/SportsYurt_brand"
WEB = ROOT / "assets/brand/web"
ICONS = ROOT / "icons"


def copy(source, target):
    copyfile(SOURCE / source, ROOT / target)


def build():
    WEB.mkdir(parents=True, exist_ok=True)
    ICONS.mkdir(parents=True, exist_ok=True)
    for theme, colourway in [("day", "signature-light"), ("night", "signature-dark")]:
        for kind, folder in [("logo", "lockup"), ("wordmark", "wordmark"), ("symbol", "symbol")]:
            copy(f"logo/{folder}/sportsyurt_{folder}_{colourway}.svg", f"assets/brand/web/sportsyurt-{kind}-{theme}.svg")
        copy(f"app-icons/colourways/{colourway}/sportsyurt_icon_{colourway}_256.png", f"assets/brand/web/sportsyurt-app-icon-{theme}.png")
    copy("logo/png/lockup/sportsyurt_lockup_signature-dark_2400w.png", "assets/brand/web/sportsyurt-logo.png")
    copy("web/icon-512.png", "assets/brand/web/sportsyurt-app-icon.png")
    for size in [16, 32, 48]:
        copy(f"web/favicon-{size}x{size}.png", f"icons/sportsyurt-favicon-{size}.png")
    for extension in ["ico", "svg"]:
        copy(f"web/favicon.{extension}", f"icons/sportsyurt-favicon.{extension}")
    copy("web/favicon.ico", "favicon.ico")
    copy("web/apple-touch-icon.png", "icons/sportsyurt-app-180.png")
    for size in [192, 512]:
        copy(f"web/icon-{size}.png", f"icons/sportsyurt-app-{size}.png")
    copy("web/icon-maskable-512.png", "icons/sportsyurt-app-maskable-512.png")
    # Raster fallback for email and social link previews; preserve aspect ratio.
    artwork = Image.open(WEB / "sportsyurt-logo.png").convert("RGBA")
    artwork.thumbnail((960, 320), Image.Resampling.LANCZOS)
    preview = Image.new("RGBA", (1200, 630), "#222026")
    preview.alpha_composite(artwork, ((1200-artwork.width)//2, (630-artwork.height)//2))
    preview.save(WEB / "sportsyurt-social-preview.png", optimize=True)
    print("SportsYurt v4 deployment assets built from supplied masters.")


if __name__ == "__main__":
    build()
