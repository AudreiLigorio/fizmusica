#!/usr/bin/env python3
# Gera overlays de texto (legenda por cena + barra de marca) como PNGs
# transparentes, pra sobrepor no vídeo via ffmpeg overlay (drawtext do ffmpeg
# local não tem freetype). Generalização de make_text_overlays.py pra N cenas
# dinâmicas e canvas de tamanho variável (por plataforma).
#
# Uso: python3 overlays.py <recipe.json> <out_dir> <w> <h>
# recipe.json: { "scenes": [{"caption": "..."}], "handle": "@...", "cta": "..." }
import sys
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
FONT_BOLD = HERE / "../../lib/content/fonts/DMSans-ExtraBold.ttf"
FONT_SEMI = HERE / "../../lib/content/fonts/DMSans-SemiBold.ttf"


def wrapped_lines(draw, text, font, max_width):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if draw.textlength(test, font=font) <= max_width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def caption_png(w, h, text, out, fontsize, color=(255, 255, 255, 255), box_color=(0, 0, 0, 90)):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(str(FONT_BOLD), fontsize)
    max_w = w - int(w * 0.15)
    lines = wrapped_lines(draw, text, font, max_w)
    line_h = int(fontsize * 1.25)
    block_h = line_h * len(lines)
    y0 = h - int(h * 0.22) - block_h
    pad = int(fontsize * 0.5)
    widths = [draw.textlength(l, font=font) for l in lines]
    box_w = max(widths) + pad * 2
    draw.rounded_rectangle(
        [(w - box_w) / 2, y0 - pad, (w + box_w) / 2, y0 + block_h + pad],
        radius=20, fill=box_color,
    )
    y = y0
    for line, lw in zip(lines, widths):
        draw.text(((w - lw) / 2, y), line, font=font, fill=color)
        y += line_h
    img.save(out)


def brand_bar_png(w, h, handle, cta, out):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    bar_h = int(h * 0.088)
    c1, c2 = (240, 25, 107), (217, 70, 239)
    for x in range(w):
        t = x / w
        r = int(c1[0] + (c2[0] - c1[0]) * t)
        g = int(c1[1] + (c2[1] - c1[1]) * t)
        b = int(c1[2] + (c2[2] - c1[2]) * t)
        draw.line([(x, h - bar_h), (x, h)], fill=(r, g, b, 235))
    font = ImageFont.truetype(str(FONT_SEMI), int(w * 0.044))
    pad_x = int(w * 0.065)
    text_y = h - int(bar_h * 0.68)
    draw.text((pad_x, text_y), handle, font=font, fill=(255, 255, 255, 255))
    cta_w = draw.textlength(cta, font=font)
    draw.text((w - cta_w - pad_x, text_y), cta, font=font, fill=(255, 255, 255, 255))
    img.save(out)


if __name__ == "__main__":
    recipe_path, out_dir, w, h = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    recipe = json.loads(Path(recipe_path).read_text(encoding="utf-8"))
    out_dir = Path(out_dir)

    fontsize = int(w * 0.058)
    for i, scene in enumerate(recipe["scenes"]):
        is_last = i == len(recipe["scenes"]) - 1
        color = tuple(recipe.get("emphasisColor", [79, 195, 247, 255])) if is_last else (255, 255, 255, 255)
        size = int(fontsize * 1.7) if is_last else fontsize
        caption_png(w, h, scene["caption"], out_dir / f"cap{i + 1}.png", size, color=color)

    brand_bar_png(w, h, recipe["handle"], recipe["cta"], out_dir / "brand.png")
    print(json.dumps({"ok": True, "count": len(recipe["scenes"])}))
