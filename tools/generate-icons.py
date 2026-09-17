#!/usr/bin/env python3
"""Generate the PWA icon set from a source logo image.

Usage:
    python3 tools/generate-icons.py path/to/k2.png

Writes icons/icon-192.png, icons/icon-512.png, icons/apple-touch-icon.png,
and maskable variants (logo padded into the safe zone on a solid teal
background) into icons/.

If no source image is given, generates a plain placeholder "K" logo instead,
so the app has something to show before the real logo is available.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

TEAL = (0, 156, 149, 255)
ICONS_DIR = Path(__file__).resolve().parent.parent / 'icons'


def make_placeholder(size):
    img = Image.new('RGBA', (size, size), TEAL)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', int(size * 0.55))
    except OSError:
        font = ImageFont.load_default()
    text = 'K'
    bbox = draw.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]), text, font=font, fill='white')
    return img


WHITE = (255, 255, 255, 255)


def fit_square(img, size, bg=(0, 0, 0, 0)):
    img = img.convert('RGBA')
    ratio = min(size / img.width, size / img.height)
    new_w, new_h = int(img.width * ratio), int(img.height * ratio)
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), bg)
    canvas.paste(resized, ((size - new_w) // 2, (size - new_h) // 2), resized)
    return canvas


def maskable(img, size):
    # Maskable icons need the logo inside a ~66% safe zone on a solid bg
    canvas = Image.new('RGBA', (size, size), WHITE)
    inner = int(size * 0.66)
    logo = fit_square(img, inner)
    canvas.paste(logo, ((size - inner) // 2, (size - inner) // 2), logo)
    return canvas


def main():
    ICONS_DIR.mkdir(exist_ok=True)
    src_path = sys.argv[1] if len(sys.argv) > 1 else None
    source = Image.open(src_path) if src_path else None

    for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'apple-touch-icon.png')]:
        base = fit_square(source, size, bg=WHITE) if source else make_placeholder(size)
        if name == 'apple-touch-icon.png':
            # apple touch icons should not be transparent
            flat = Image.new('RGB', (size, size), (255, 255, 255))
            flat.paste(base, (0, 0), base)
            flat.save(ICONS_DIR / name)
        else:
            base.save(ICONS_DIR / name)

    for size, name in [(192, 'icon-maskable-192.png'), (512, 'icon-maskable-512.png')]:
        m = maskable(source, size) if source else make_placeholder(size)
        m.save(ICONS_DIR / name)

    print(f"Icons written to {ICONS_DIR} (source: {src_path or 'placeholder'})")


if __name__ == '__main__':
    main()
