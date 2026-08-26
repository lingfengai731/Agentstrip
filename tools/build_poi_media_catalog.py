from __future__ import annotations

import html
import json
import re
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "wandermind-studio/frontend/assets/data"
OUT = DATA / "poi-media-catalog.json"


COMMONS_TITLES = {
    "batu_bolong_beach": "File:Batu Bolong Beach, Canggu.jpg",
    "echo_beach": "File:La Brisa beach club at Echo Beach, Canggu, Bali.jpg",
    "petitenget_temple": "File:Pura Petitenget.jpg",
    "padang_padang_beach": "File:Padang Padang Beach Bali.jpg",
    "pandawa_beach": "File:Pandawa Beach, Kuta Selatan - Bali.jpg",
    "bingin_beach": "File:Bingin Beach.PNG",
    "nusa_dua_beach": "File:Nusa Dua beach Bali.jpg",
    "sanur_beach": "File:Pantai Sanur di waktu terbit matahari.jpg",
    "mertasari_beach": "File:Sunset di Pantai Mertasari.jpg",
    "suluban_beach": "File:Pantai suluban blue point bali.jpg",
    "angels_billabong": "File:Angel Billabong, Nusa Penida.jpg",
    "crystal_bay": "File:Crystal Bay, Nusa Penida 2017-08-20 (12).jpg",
    "diamond_beach": "File:Diamond Beach in Nusa Penida, Bali.jpg",
    "rumah_pohon_molenteng": "File:Amazing Tree House at Nusa Penida.jpg",
    "atuh_beach": "File:Atuh Beach, Nusa Penida Bali.jpg",
    "goa_gajah": "File:Goa Gajah temple, Bedulu, Bali, Indonesia, 20220824 0929 0544.jpg",
    "tegenungan_waterfall": "File:Tegenungan Waterfall 2017-08-18 (2).jpg",
    "kanto_lampo_waterfall": "File:Kanto lampo waterfall.jpg",
    "banyumala_waterfall": "File:Banyumala Waterfall.jpg",
    "munduk_waterfall": "File:Munduk Tutub Waterfall SF0001.jpg",
    "gitgit_waterfall": "File:Gitgit Waterfall, Campuhan area, Bali, Indonesia.jpg",
    "tamblingan_lake": "File:Lake Tamblingan.jpg",
    "batur_hot_springs": "File:Hot spring of Toyabungkah 200507.jpg",
    "tukad_cepung_waterfall": "File:Tukad Cepung Waterfall (52462237566).jpg",
    "taman_ujung": 'File:Taman Ujung "Istana Air", Bali 2.jpg',
    "amed_beach": "File:Bali-amed-village-fishing-beach-boats.jpg",
    "tulamben": "File:21-Indonesia-Bali Tulamben 35 (School of Jack Fish)-APiazza.JPG",
    "sidemen_valley": "File:Sidemen sawah countryside (Bali, Indonesia 2016) (30039194120).jpg",
    "virgin_beach": "File:Virgin Beach Bali.jpg",
}


LOCAL_VISUALS = {
    "heart_space_bali": ("assets/images/generated/sound-healing-illustration.png", "experience_context"),
    "bali_fire_shooting_club": ("assets/images/generated/indoor-range-illustration.png", "experience_context"),
    "celuk_village": ("assets/images/generated/silver-workshop-illustration.png", "experience_context"),
    "celuk_silver_class": ("assets/images/generated/silver-workshop-illustration.png", "experience_context"),
    "tibumana_waterfall": ("assets/images/generated/tropical-waterfall-illustration.png", "terrain_context"),
    "thousand_islands_viewpoint": ("assets/images/web/682e4b7b296cd26a.webp", "area_context"),
    "mount_batur_trailhead": ("assets/images/web/8955be34cbcf96c6.webp", "area_context"),
    "mount_batur_jeep": ("assets/images/web/15c41f6a0fe7fec3.webp", "area_context"),
}


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", value or ""))).strip()


def commons_images(titles: list[str]) -> dict[str, dict]:
    response = requests.get(
        "https://commons.wikimedia.org/w/api.php",
        params={
            "action": "query",
            "titles": "|".join(titles),
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "iiurlwidth": 1280,
            "format": "json",
            "origin": "*",
        },
        headers={"User-Agent": "WanderMind-media-catalog/1.0 (contact@wandermind.cc)"},
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    results = {}
    for page in payload["query"]["pages"].values():
        info = page["imageinfo"][0]
        meta = info.get("extmetadata") or {}
        creator = clean((meta.get("Artist") or {}).get("value", "")) or "Wikimedia Commons contributor"
        license_name = clean((meta.get("LicenseShortName") or {}).get("value", "")) or "See source"
        license_url = clean((meta.get("LicenseUrl") or {}).get("value", ""))
        results[page["title"]] = {
            "image_url": info.get("thumburl") or info["url"],
            "thumbnail_url": info.get("thumburl") or info["url"],
            "rights": {
                "status": "licensed",
                "creator": creator,
                "license_name": license_name,
                "license_url": license_url,
                "source_url": info.get("descriptionurl", ""),
            },
        }
    return results


def main() -> None:
    travel = json.loads((DATA / "bali-travel-data.json").read_text(encoding="utf-8"))
    manifest = json.loads((DATA / "image-publish-manifest.json").read_text(encoding="utf-8"))
    already = {poi_id for image in manifest["images"] for poi_id in image.get("poi_ids", [])}
    pois = {poi["id"]: poi for poi in travel["pois"]}
    missing = sorted(set(pois) - already)
    expected = sorted(set(COMMONS_TITLES) | set(LOCAL_VISUALS))
    if missing != expected:
        raise SystemExit(f"Catalog mapping drift. missing={missing}; mapped={expected}")

    commons = commons_images(list(COMMONS_TITLES.values()))
    if set(commons) != set(COMMONS_TITLES.values()):
        raise SystemExit(f"Commons title drift: {sorted(set(COMMONS_TITLES.values()) - set(commons))}")

    entries = []
    for poi_id in missing:
        poi = pois[poi_id]
        if poi_id in COMMONS_TITLES:
            entry = commons[COMMONS_TITLES[poi_id]]
            scope = "exact_place"
        else:
            path, scope = LOCAL_VISUALS[poi_id]
            entry = {
                "image_url": path,
                "thumbnail_url": path,
                "rights": {
                    "status": "wanderMind_illustration" if path.startswith("assets/images/generated/") else "user_provided_with_consent",
                    "creator": "WanderMind Studio",
                    "license_name": "WanderMind project use",
                    "license_url": "",
                    "source_url": poi.get("official_url", ""),
                },
            }
        entry.update(
            {
                "poi_ids": [poi_id],
                "media_scope": scope,
                "alt_text": {
                    "en": f"{poi['name']} visual reference",
                    "zh": f"{poi['name']} 视觉参考",
                    "ja": f"{poi['name']} のビジュアル参考",
                    "ko": f"{poi['name']} 시각 참고",
                    "id": f"Referensi visual {poi['name']}",
                },
            }
        )
        entries.append(entry)

    OUT.write_text(
        json.dumps(
            {
                "schema_version": "1.0.0",
                "updated_at": "2026-08-26",
                "policy": "Exact reusable place photos are preferred. Generated or area-level media is labelled and must never be presented as an exact venue photo.",
                "images": entries,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT} with {len(entries)} entries")


if __name__ == "__main__":
    main()
