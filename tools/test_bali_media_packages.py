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
    supplemental = load_json("assets/data/poi-media-catalog.json")
    packages = load_json("assets/data/bali-experience-packages.json")
    bali_html = (FRONTEND / "bali.html").read_text(encoding="utf-8")
    package_script = (FRONTEND / "assets/js/bali-packages.js").read_text(encoding="utf-8")

    active_pois = {poi["id"] for poi in travel["pois"] if poi.get("verification_status") != "retired"}
    media_by_poi: dict[str, dict] = {}
    for manifest in (published, supplemental):
        for image in manifest.get("images", []):
            for poi_id in image.get("poi_ids", []):
                media_by_poi.setdefault(poi_id, image)

    missing = sorted(active_pois - media_by_poi.keys())
    assert not missing, f"POIs without media: {missing}"

    allowed_licenses = {"CC0", "CC BY 2.0", "CC BY 3.0", "CC BY 4.0", "CC BY-SA 2.0", "CC BY-SA 3.0", "CC BY-SA 4.0", "Public domain"}
    exact_count = 0
    contextual_count = 0
    for image in supplemental.get("images", []):
        scope = image.get("media_scope")
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

    assert len(package_ids) >= 8, "Expected the initial eight-package catalog"
    assert "poi-media-catalog.json" in bali_html
    assert "assets/js/bali-packages.js" in bali_html
    assert "bali-experience-packages.json" in package_script
    assert "该地点照片尚未接入" not in bali_html
    assert "Photo for this place has not been added yet" not in bali_html

    print(
        f"Bali checks passed: {len(active_pois)}/{len(active_pois)} POIs covered, "
        f"{exact_count} new exact photos, {contextual_count} labelled context visuals, "
        f"{len(package_ids)} packages"
    )


if __name__ == "__main__":
    main()
