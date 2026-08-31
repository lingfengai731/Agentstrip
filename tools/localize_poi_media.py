"""Mirror licensed POI display images into WanderMind-controlled WebP assets.

The source page, creator and licence stay in the catalog. Only the browser-facing
image URLs change, avoiding fragile third-party hotlinks on mobile Safari.
"""

from __future__ import annotations

import hashlib
import io
import json
import re
from pathlib import Path

import requests
from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "wandermind-studio" / "frontend"
CATALOG = FRONTEND / "assets" / "data" / "poi-media-catalog.json"
OUTPUT = FRONTEND / "assets" / "images" / "poi" / "commons"
USER_AGENT = "WanderMind-media-mirror/1.0 (contact@wandermind.cc)"


def safe_slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def write_webp(image: Image.Image, path: Path, max_width: int, quality: int) -> None:
    image = ImageOps.exif_transpose(image).convert("RGB")
    if image.width > max_width:
        height = max(1, round(image.height * max_width / image.width))
        image = image.resize((max_width, height), Image.Resampling.LANCZOS)
    temporary = path.with_suffix(path.suffix + ".tmp")
    image.save(temporary, format="WEBP", quality=quality, method=6)
    temporary.replace(path)


def main() -> None:
    payload = json.loads(CATALOG.read_text(encoding="utf-8"))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    localized = 0

    for index, entry in enumerate(payload.get("images", []), start=1):
        source_url = entry.get("image_url", "")
        if not source_url.startswith(("http://", "https://")):
            continue
        poi_ids = entry.get("poi_ids") or []
        slug = safe_slug(poi_ids[0] if poi_ids else f"poi-{index}")
        response = session.get(source_url, timeout=45)
        response.raise_for_status()
        source_bytes = response.content
        source_hash = hashlib.sha256(source_bytes).hexdigest()
        image = Image.open(io.BytesIO(source_bytes))

        web_path = OUTPUT / f"{slug}.webp"
        thumb_path = OUTPUT / f"{slug}-thumb.webp"
        write_webp(image, web_path, max_width=1600, quality=84)
        write_webp(image, thumb_path, max_width=640, quality=80)

        rights = entry.setdefault("rights", {})
        rights.setdefault("source_delivery_url", source_url)
        entry["source_sha256"] = source_hash
        entry["image_url"] = web_path.relative_to(FRONTEND).as_posix()
        entry["thumbnail_url"] = thumb_path.relative_to(FRONTEND).as_posix()
        localized += 1

    payload["schema_version"] = "1.1.0"
    payload["updated_at"] = "2026-09-01"
    payload["policy"] = (
        "Browser-facing POI media is served from WanderMind-controlled WebP assets. "
        "Original source pages, creators and licences remain recorded for attribution. "
        "Generated or area-level media stays labelled and is never presented as an exact venue photo."
    )
    temporary_catalog = CATALOG.with_suffix(".json.tmp")
    temporary_catalog.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary_catalog.replace(CATALOG)
    print(f"Localized {localized} POI images into {OUTPUT}")


if __name__ == "__main__":
    main()
