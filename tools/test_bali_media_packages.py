"""Static release checks for Bali POI media coverage and experience packages."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "wandermind-studio" / "frontend"


def load_json(relative_path: str) -> dict:
    return json.loads((FRONTEND / relative_path).read_text(encoding="utf-8"))


def main() -> None:
    travel = load_json("assets/data/bali-travel-data.json")
    published = load_json("assets/data/image-publish-manifest.json")
    rights = load_json("assets/data/image-rights-manifest.json")
    supplemental = load_json("assets/data/poi-media-catalog.json")
    packages = load_json("assets/data/bali-experience-packages.json")
    bali_html = (FRONTEND / "bali.html").read_text(encoding="utf-8")
    package_script = (FRONTEND / "assets/js/bali-packages.js").read_text(encoding="utf-8")

    active_pois = {poi["id"] for poi in travel["pois"] if poi.get("verification_status") != "retired"}
    media_by_poi: dict[str, dict] = {}
    media_count_by_poi: dict[str, int] = {}
    for manifest in (published, supplemental):
        for image in manifest.get("images", []):
            for poi_id in image.get("poi_ids", []):
                media_by_poi.setdefault(poi_id, image)
                media_count_by_poi[poi_id] = media_count_by_poi.get(poi_id, 0) + 1

    missing = sorted(active_pois - media_by_poi.keys())
    assert not missing, f"POIs without media: {missing}"
    assert media_count_by_poi.get("mount_batur_trailhead", 0) >= 4
    assert media_count_by_poi.get("mount_batur_jeep", 0) >= 4
    assert media_count_by_poi.get("lovina_dolphin_watching", 0) >= 2
    assert media_count_by_poi.get("batur_hot_springs", 0) >= 2
    assert media_count_by_poi.get("besakih_temple", 0) >= 4
    assert media_count_by_poi.get("celuk_silver_class", 0) >= 1
    assert media_count_by_poi.get("celuk_village", 0) >= 1
    assert media_count_by_poi.get("batur_black_lava", 0) >= 1

    expected_new_hashes = {
        "97be9dc87a3c259ab620824b397cda5aa2c1463c128c2bc7962ff859f1bb1664",
        "155eb6c2ac337f9e443c49f8a2f95f825c9171b3bcab30e6a1c7cc7f62c14983",
        "8ca5792038ec2b661c31637e1bccd6492f29c8be3ee7ef57a6d19bf8ad213ea5",
        "963b872ed7537877fcf6faf4606d39a75ad89788ef3267d688f3299dbc55591c",
        "eeef769ff13c994f9e758181aff5587cc1e86b96b320abc503d3f0ccc290ab92",
        "94b2803f91a8d2d29e505f2ac62c848bda6b1e64ac1835ade08306e8a14b73f2",
    }
    published_by_hash = {image.get("sha256"): image for image in published.get("images", [])}
    rights_by_hash = {asset.get("sha256"): asset for asset in rights.get("assets", [])}
    assert len(published.get("images", [])) == 125
    assert len(rights.get("assets", [])) == 125
    assert expected_new_hashes <= published_by_hash.keys()
    assert expected_new_hashes <= rights_by_hash.keys()
    for image_hash in expected_new_hashes:
        image = published_by_hash[image_hash]
        asset = rights_by_hash[image_hash]
        assert image["rights"]["status"] == "user_provided_with_consent"
        assert asset["publishable"] is True
        assert set(image["title"]) == {"zh", "en", "ja", "ko", "id"}
        for image_path in (image["relative_path"], image["web_optimized_path"], image["thumbnail_path"]):
            assert (FRONTEND / image_path).is_file(), f"Missing approved visual: {image_path}"

    hot_spring_media = [
        image
        for image in supplemental.get("images", [])
        if "batur_hot_springs" in image.get("poi_ids", [])
    ]
    hot_spring_media.sort(key=lambda image: image.get("display_priority", 100))
    assert hot_spring_media[0]["image_url"].endswith("8955be34cbcf96c6.webp")
    assert all(image.get("media_scope") == "area_context" for image in hot_spring_media)

    r5 = next(route for route in travel["routes"] if route["id"] == "R5")
    assert r5["free_outline"][0]["suggested_poi_ids"] == ["besakih_temple"]
    assert r5["free_outline"][1]["suggested_poi_ids"] == ["mount_batur_trailhead", "mount_batur_jeep", "batur_black_lava"]
    assert r5["free_outline"][2]["suggested_poi_ids"][0] == "batur_hot_springs"
    assert len({day["suggested_poi_ids"][0] for day in r5["free_outline"][:3]}) == 3

    jeep = next(poi for poi in travel["pois"] if poi["id"] == "mount_batur_jeep")
    assert jeep["booking_url"] == "https://mountbaturjeeptour.com/"
    assert set(jeep["supplier_note"]) == {"zh", "en", "ja", "ko", "id"}

    black_lava = next(poi for poi in travel["pois"] if poi["id"] == "batur_black_lava")
    assert black_lava["verification_status"] == "verified"
    assert set(black_lava["name_i18n"]) == {"zh", "en", "ja", "ko", "id"}
    black_lava_image = next(
        image for image in published["images"]
        if "batur_black_lava" in image.get("poi_ids", [])
    )
    assert black_lava_image["sha256"] == "a7b2b7c21989ddc7a49c6017c6cae902a7d8d37b2f0c6191197c3340b462208b"
    assert black_lava_image["rights"]["status"] == "user_provided_with_consent"
    assert set(black_lava_image["title"]) == {"zh", "en", "ja", "ko", "id"}
    for image_path in (black_lava_image["web_optimized_path"], black_lava_image["thumbnail_path"]):
        assert (FRONTEND / image_path).is_file(), f"Missing Black Lava visual: {image_path}"

    allowed_licenses = {"CC0", "CC BY 2.0", "CC BY 3.0", "CC BY 4.0", "CC BY-SA 2.0", "CC BY-SA 3.0", "CC BY-SA 4.0", "Public domain"}
    exact_count = 0
    contextual_count = 0
    for image in supplemental.get("images", []):
        scope = image.get("media_scope")
        for field in ("image_url", "thumbnail_url"):
            display_url = image.get(field, "")
            assert not display_url.startswith(("http://", "https://")), f"External display hotlink: {image.get('poi_ids')} {field}"
            assert (FRONTEND / display_url).is_file(), f"Missing controlled display asset: {display_url}"
        if scope == "exact_place":
            exact_count += 1
            rights = image.get("rights", {})
            assert rights.get("source_url"), f"Missing source URL: {image.get('id')}"
            assert rights.get("license_name") in allowed_licenses, f"Unapproved license: {image.get('id')}"
        else:
            contextual_count += 1
            assert scope in {"experience_context", "terrain_context", "area_context"}, f"Bad media scope: {scope}"
            local_path = image.get("image_url", "")
            if local_path and not local_path.startswith(("http://", "https://")):
                assert (FRONTEND / local_path).is_file(), f"Missing local visual: {local_path}"

    package_ids: set[str] = set()
    route_ids = {route["id"] for route in travel["routes"]}
    regions_by_poi = {poi["id"]: poi.get("region_id") for poi in travel["pois"]}
    for package in packages.get("packages", []):
        package_id = package["id"]
        assert package_id not in package_ids, f"Duplicate package ID: {package_id}"
        package_ids.add(package_id)
        assert package.get("duration_days") in {1, 2}, f"Unexpected duration: {package_id}"
        assert package.get("route_id") in route_ids, f"Unknown route: {package_id}"
        assert set(package.get("core", [])) <= active_pois, f"Unknown core POI: {package_id}"
        assert set(package.get("add_ons", [])) <= active_pois, f"Unknown add-on POI: {package_id}"
        assert package.get("status") in {"live_check", "needs_supplier_confirmation"}, f"Bad status: {package_id}"
        region_ids = set(package.get("region_ids", []))
        assert region_ids, f"Package has no geographic cluster: {package_id}"
        package_pois = package.get("core", []) + package.get("add_ons", [])
        assert all(regions_by_poi.get(poi_id) in region_ids for poi_id in package_pois), f"Package crosses its geographic cluster: {package_id}"
        assert set(package.get("area", {})) >= {"zh", "en", "ja", "ko", "id"}, f"Package area is not localized: {package_id}"

    penida_packages = [item for item in packages["packages"] if item["id"].startswith("penida-")]
    assert len(penida_packages) == 3
    assert all(item.get("departure_port") == "Sanur Harbour" for item in penida_packages)
    assert all(item.get("supplier_candidate") == "Axestone Fast Cruise" for item in penida_packages)
    penida_schedule = packages["transport_policies"]["nusa_penida"]["schedule"]
    assert penida_schedule["verified_at"] == "2026-09-01"
    assert penida_schedule["source_url"] == "https://axestonefastcruise.com/time-schedule/"
    assert penida_schedule["sanur_to_penida"] == ["06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "11:00", "15:30"]
    assert penida_schedule["penida_to_sanur"] == ["09:15", "14:30", "15:30", "16:00", "16:30", "17:00"]
    west_package = next(item for item in penida_packages if item["id"] == "penida-west-one-day")
    west_price = west_package.get("published_price", {})
    assert west_price.get("amount_idr") == 2_000_000
    assert west_price.get("party_size") == 2
    assert west_price.get("pricing_unit") == "total"
    assert west_price.get("status") == "permanent_owner_authorized"
    assert "final_price" not in west_package.get("live_checks", [])
    assert all(not item.get("published_price") for item in penida_packages if item["id"] != "penida-west-one-day")
    assert "north-bali-lovina-overnight" in package_ids
    assert {"lovina_beach", "lovina_dolphin_watching"} <= active_pois
    batur_package = next(item for item in packages["packages"] if item["id"] == "batur-dawn-choice")
    assert "batur_black_lava" in batur_package["add_ons"]

    assert len(package_ids) >= 8, "Expected the initial eight-package catalog"
    assert "poi-media-catalog.json" in bali_html
    assert "poi-media-catalog.json?v=20260911p1" in bali_html
    assert "bali-travel-data.json?v=20260911p2" in bali_html
    assert "image-publish-manifest.json?v=20260911p2" in bali_html
    assert "assets/js/bali-packages.js" in bali_html
    assert "bali-packages.js?v=20260911p1" in bali_html
    assert "bali-experience-packages.json?v=20260911p1" in package_script
    assert "bali-experience-packages.json" in package_script
    assert "renderSchedule(item, c)" in package_script
    assert "该地点照片尚未接入" not in bali_html
    assert "Photo for this place has not been added yet" not in bali_html

    print(
        f"Bali checks passed: {len(active_pois)}/{len(active_pois)} POIs covered, "
        f"{exact_count} new exact photos, {contextual_count} labelled context visuals, "
        f"{len(package_ids)} packages"
    )


if __name__ == "__main__":
    main()
