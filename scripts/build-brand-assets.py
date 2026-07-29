#!/usr/bin/env python3
"""Build responsive nothingsport brand assets from the supplied master PNGs."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "brand" / "source"
WEB = ROOT / "assets" / "brand" / "web"
ICONS = ROOT / "icons"

MASTER_ASSETS = {
    "logo": SOURCE / "nothingsport-logo-master.png",
    "hero": SOURCE / "nothingsport-hero-logo-master.png",
    "icon": SOURCE / "nothingsport-app-icon-master.png",
    "slogan": SOURCE / "nothingsport-logo-slogan-master.png",
}

WEB_ASSETS = {
    "logo": (WEB / "nothingsport-logo.png", 1200, 0.035),
    "hero": (WEB / "nothingsport-hero-logo.png", 1400, 0.025),
    "icon": (WEB / "nothingsport-app-icon.png", 720, 0.035),
    "slogan": (WEB / "nothingsport-logo-slogan.png", 1200, 0.025),
}

NIGHT = (10, 10, 15, 255)


def trimmed_with_clear_space(path: Path, padding_ratio: float) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError(f"{path} has no visible pixels")

    visible = image.crop(bounds)
    clear_space = max(1, round(max(visible.size) * padding_ratio))
    canvas = Image.new(
        "RGBA",
        (visible.width + clear_space * 2, visible.height + clear_space * 2),
        (0, 0, 0, 0),
    )
    canvas.alpha_composite(visible, (clear_space, clear_space))
    return canvas


def resized_to_width(image: Image.Image, width: int) -> Image.Image:
    height = round(image.height * width / image.width)
    return image.resize((width, height), Image.Resampling.LANCZOS)


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def build_web_assets() -> None:
    for key, (output_path, width, padding_ratio) in WEB_ASSETS.items():
        artwork = trimmed_with_clear_space(MASTER_ASSETS[key], padding_ratio)
        save_png(resized_to_width(artwork, width), output_path)


def icon_canvas(size: int, artwork_ratio: float) -> Image.Image:
    artwork = trimmed_with_clear_space(MASTER_ASSETS["icon"], 0)
    target = max(1, round(size * artwork_ratio))
    artwork.thumbnail((target, target), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (size, size), NIGHT)
    x = round((size - artwork.width) / 2)
    y = round((size - artwork.height) / 2 - size * 0.012)
    canvas.alpha_composite(artwork, (x, y))
    return canvas


def build_app_icons() -> None:
    outputs = [
        (ICONS / "nothingsport-app-32.png", 32, 0.86),
        (ICONS / "nothingsport-app-180.png", 180, 0.78),
        (ICONS / "nothingsport-app-192.png", 192, 0.78),
        (ICONS / "nothingsport-app-512.png", 512, 0.78),
        (ICONS / "nothingsport-app-maskable-512.png", 512, 0.60),
    ]
    for path, size, artwork_ratio in outputs:
        save_png(icon_canvas(size, artwork_ratio), path)


def build_social_preview() -> None:
    width, height = 1200, 630
    canvas = Image.new("RGBA", (width, height), NIGHT)

    # Keep the supplied skier lockup dominant while respecting common social crops.
    artwork = trimmed_with_clear_space(MASTER_ASSETS["hero"], 0.015)
    artwork.thumbnail((1080, 570), Image.Resampling.LANCZOS)
    x = round((width - artwork.width) / 2)
    y = round((height - artwork.height) / 2)
    canvas.alpha_composite(artwork, (x, y))
    save_png(canvas, WEB / "nothingsport-social-preview.png")


def main() -> None:
    missing = [str(path) for path in MASTER_ASSETS.values() if not path.exists()]
    if missing:
        raise SystemExit("Missing nothingsport master assets:\n" + "\n".join(missing))

    build_web_assets()
    build_app_icons()
    build_social_preview()
    print("Built nothingsport web, app-icon, and social-preview assets.")


if __name__ == "__main__":
    main()
