"""Generate PF2 Director's StartPlaying dice models and preview."""

import argparse
import math
import runpy
from collections import Counter
from functools import cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
TILE = 128
NAVY = (0, 63, 94)
BLUE = (11, 125, 184)
SHADOW = (0, 26, 43)
ICE = (229, 247, 255)
TRIM = (42, 141, 187)
BEVEL = (6, 85, 123)


def blend(a, b, fraction):
    return tuple(round(x + (y - x) * fraction) for x, y in zip(a, b))


def logo_mask(path):
    """Recover the logo coverage from the two-color, opaque attachment."""
    with Image.open(path) as image:
        source = image.convert("RGB")
    counts = Counter(source.get_flattened_data())
    background, ink = (color for color, _ in counts.most_common(2))
    channel = max(range(3), key=lambda index: abs(ink[index] - background[index]))
    span = ink[channel] - background[channel]
    mask = source.getchannel(channel).point(
        lambda sample: max(0, min(255, round(255 * (sample - background[channel]) / span)))
    )
    return mask.crop(mask.getbbox())


@cache
def font(path, size):
    return ImageFont.truetype(path, size)


def number(tile, label, at, size, font_path):
    draw = ImageDraw.Draw(tile)
    glyph = font(font_path, size)
    left, top, right, bottom = glyph.getbbox(label)
    x, y = at
    draw.text((x - (left + right) / 2, y - (top + bottom) / 2), label, font=glyph,
              fill=ICE, stroke_width=1, stroke_fill=SHADOW)
    if label in {"6", "9", "60", "90"}:
        half_width = (right - left) * .28
        baseline = y + (bottom - top) / 2 + 3
        draw.line((x - half_width, baseline, x + half_width, baseline), fill=(136, 206, 236), width=2)


def sparkle(draw, x, y, radius, color):
    draw.polygon([(x, y - radius), (x + 1, y - 1), (x + radius, y), (x + 1, y + 1),
                  (x, y + radius), (x - 1, y + 1), (x - radius, y), (x - 1, y - 1)], fill=color)


@cache
def enamel():
    tile = Image.new("RGB", (TILE, TILE))
    tile.putdata([
        blend(SHADOW, NAVY, .27 + .69 * max(0, 1 - math.hypot(x - 34, y - 20) / 128))
        for y in range(TILE) for x in range(TILE)
    ])
    return tile


def paint_face(kind, value, polygon, loop, logo, font_path):
    tile = enamel().copy()
    draw = ImageDraw.Draw(tile)
    cx = sum(x for x, _ in polygon) / len(polygon)
    cy = sum(y for _, y in polygon) / len(polygon)

    for inset, color, width in ((.96, BLUE, 2), (.87, TRIM, 1), (.80, NAVY, 1)):
        edge = [(cx + (x - cx) * inset, cy + (y - cy) * inset) for x, y in polygon]
        draw.line([*edge, edge[0]], color, width=width, joint="curve")

    if kind == "d4":
        for vertex, (x, y) in zip(loop, polygon):
            digit = Image.new("RGBA", (32, 32))
            number(digit, str((1, 2, 4, 3)[vertex]), (16, 16), 22, font_path)
            angle = math.degrees(math.atan2(cy - y, x - cx)) - 90
            digit = digit.rotate(angle, Image.Resampling.BICUBIC)
            tile.paste(digit, (round(cx + (x - cx) * .57 - 16),
                               round(cy + (y - cy) * .57 - 16)), digit)
        sparkle(draw, cx, cy, 6, TRIM)
        return tile

    if kind == "d20" and value == 20:
        draw.ellipse((cx - 25, cy - 25, cx + 25, cy + 25), fill=SHADOW, outline=TRIM)
        position = (round(cx - logo.width / 2), round(cy - logo.height / 2 + 1))
        halo = logo.filter(ImageFilter.GaussianBlur(2))
        tile.paste(TRIM, (*position, position[0] + logo.width, position[1] + logo.height), halo)
        tile.paste(BLUE, (*position, position[0] + logo.width, position[1] + logo.height), logo)
        return tile

    if len(polygon) == 3:
        stars = [(cx, cy - 28, 4), (cx - 24, cy + 14, 3), (cx + 24, cy + 14, 3)]
    elif kind in {"d10", "d100"}:
        stars = [(cx, cy - 29, 4), (cx, cy + 28, 3)]
    else:
        stars = [(cx, cy - 28, 4), (cx + 33, cy, 3), (cx, cy + 28, 4), (cx - 33, cy, 3)]
    for x, y, radius in stars:
        sparkle(draw, x, y, radius, TRIM)

    label = str(value)
    if kind == "d10":
        label = str(value % 10)
    elif kind == "d100":
        label = f"{value % 10 * 10:02d}"
    sizes = {"d2": 42, "d6": 41, "d8": 34, "d10": 33, "d12": 38, "d20": 33, "d100": 28}
    number(tile, label, (cx, cy), sizes[kind], font_path)
    return tile


def affine(source, target):
    """Map output coordinates to the source texture using three point pairs."""
    (x0, y0), (x1, y1), (x2, y2) = target
    dx1, dy1, dx2, dy2 = x1 - x0, y1 - y0, x2 - x0, y2 - y0
    determinant = dx1 * dy2 - dx2 * dy1
    if abs(determinant) < 1e-6:
        return None
    coefficients = []
    for v0, v1, v2 in zip(*source):
        a = ((v1 - v0) * dy2 - (v2 - v0) * dy1) / determinant
        b = (dx1 * (v2 - v0) - dx2 * (v1 - v0)) / determinant
        coefficients.extend((a, b, v0 - a * x0 - b * y0))
    return coefficients


def render_die(kind, geometry, atlas, vectors):
    positions, normals, uv, indices, _, panels = geometry
    dot, add, cross, unit, scale = vectors
    prominent = {"d2": 2, "d4": 4, "d6": 6, "d8": 8, "d10": 7, "d12": 12, "d20": 20, "d100": 10}
    _, (ox, oy), polygon, _ = next(panel for panel in panels if panel[0] == prominent[kind])
    x, y = polygon[0]
    start = uv.index(((ox + x) / atlas.width, (oy + y) / atlas.height))
    forward = normals[start]
    up = unit(add(positions[start], scale(forward, -dot(positions[start], forward))))
    if kind == "d2":
        tilt = (.08, .65)
    elif kind == "d4":
        tilt = (-.40, .57)
    else:
        tilt = (.36, .29)
    right = cross(up, forward)
    camera = unit(add(forward, add(scale(right, tilt[0]), scale(up, tilt[1]))))
    right = unit(cross(up, camera))
    up = cross(camera, right)
    projected = [(dot(p, right), -dot(p, up)) for p in positions]
    extent = max(max(axis) - min(axis) for axis in zip(*projected))
    factor = 224 / extent
    points = [(2 * (x * factor + 132), 2 * (y * factor + 133)) for x, y in projected]
    light = unit(add(camera, add(scale(up, .60), scale(right, -.45))))
    result = Image.new("RGBA", (528, 540))
    triangles = [indices[i:i + 3] for i in range(0, len(indices), 3)]
    triangles.sort(key=lambda triangle: sum(dot(positions[i], camera) for i in triangle))
    for triangle in triangles:
        normal = normals[triangle[0]]
        if dot(normal, camera) <= 0:
            continue
        target = [points[i] for i in triangle]
        source = [(uv[i][0] * atlas.width, uv[i][1] * atlas.height) for i in triangle]
        matrix = affine(source, target)
        if matrix is None:
            continue
        mask = Image.new("L", result.size)
        ImageDraw.Draw(mask).polygon(target, fill=255)
        shade = .56 + .40 * max(0, dot(normal, light))
        if source[0] == source[1] == source[2]:
            color = blend(SHADOW, (71, 164, 202), shade * shade)
            result.paste(color + (255,), (0, 0, *result.size), mask)
        else:
            patch = atlas.transform(result.size, Image.Transform.AFFINE, matrix, Image.Resampling.BILINEAR)
            patch = patch.point([round(level * shade) for level in range(256)] * 3)
            result.paste(patch.convert("RGBA"), (0, 0), mask)
    return result.resize((264, 270), Image.Resampling.LANCZOS)


def save_preview(path, renders, font_path):
    width, height = 1240, 710
    preview = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(preview)
    for y in range(height):
        draw.line((0, y, width, y), fill=blend((14, 37, 55), (4, 15, 28), y / height))
    draw.text((40, 27), "StartPlaying Dice", font=font(font_path, 37), fill=ICE)
    draw.line((40, 81, 1200, 81), fill=BEVEL, width=1)
    order = ("d20", "d12", "d10", "d100", "d8", "d6", "d4", "d2")
    for index, kind in enumerate(order):
        x = 46 + (index % 4) * 296
        y = 87 + (index // 4) * 304
        shadow = Image.new("L", (264, 270))
        ImageDraw.Draw(shadow).ellipse((47, 212, 217, 242), fill=180)
        preview.paste((0, 3, 10), (x, y, x + 264, y + 270), shadow.filter(ImageFilter.GaussianBlur(13)))
        die = renders[kind]
        preview.paste(die, (x, y), die)
        draw.text((x + 132, y + 267), kind, anchor="mm", font=font(font_path, 20), fill=(170, 210, 231))
    preview.save(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("wrap_generator", type=Path, help="Ponyfinder generate-heritage-wraps.py")
    parser.add_argument("--logo", type=Path, default=Path(__file__).with_name("logo.png"))
    parser.add_argument("--font", default="C:/Windows/Fonts/arialbd.ttf")
    args = parser.parse_args()
    wrap = runpy.run_path(str(args.wrap_generator))
    vectors = (wrap["dot"], lambda a, b: tuple(x + y for x, y in zip(a, b)),
               wrap["cross"], wrap["unit"], wrap["scale"])
    logo = ImageOps.contain(logo_mask(args.logo), (42, 42), Image.Resampling.LANCZOS)
    assets = ROOT / "module/dice/startplaying"
    assets.mkdir(parents=True, exist_ok=True)

    renders = {}
    for kind, radius, vertices, faces in wrap["dice_shapes"]():
        geometry = wrap["mesh"](kind, radius, vertices, faces)
        size, panels = geometry[-2:]
        atlas = Image.new("RGB", size, BEVEL)
        for value, offset, polygon, loop in panels:
            atlas.paste(paint_face(kind, value, polygon, loop, logo, args.font), offset)
        path = assets / f"{kind}.glb"
        wrap["write_glb"](path, geometry, atlas)
        renders[kind] = render_die(kind, geometry, atlas, vectors)

    save_preview(ROOT / "startplaying-dice-preview.png", renders, args.font)


if __name__ == "__main__":
    main()
