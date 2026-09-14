"""Download two explicitly licensed collection photos; retain originals and optimize copies.

Never run this to ingest arbitrary URLs. Attribution lives in the publish/rights manifests.
"""
from pathlib import Path
import hashlib
import json
import requests
from PIL import Image
from localize_poi_media import write_webp

ROOT = Path(__file__).resolve().parents[1] / 'wandermind-studio/frontend'
SOURCES = [
    ('penida-snorkeling-coast', 'https://upload.wikimedia.org/wikipedia/commons/1/10/Snorkeling_site_-_Nusa_Penida.jpg'),
    ('bali-nasi-campur', 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Nasi_Campur_Bali_Ayam_Betutu.jpg'),
]

def main():
    for name, url in SOURCES:
        original = ROOT / ('assets/images/sources/' + name + '.jpg')
        original.parent.mkdir(parents=True, exist_ok=True)
        response = requests.get(url, headers={'User-Agent': 'WanderMind-media/1.0 (licensed image intake)'}, timeout=30)
        response.raise_for_status()
        if not response.headers.get('Content-Type', '').startswith('image/'):
            raise ValueError('Source is not an image')
        image_bytes = response.content
        digest = hashlib.sha256(image_bytes).hexdigest()
        if original.exists() and hashlib.sha256(original.read_bytes()).hexdigest() != digest:
            raise ValueError('Original changed; review before replacement')
        if not original.exists():
            original.write_bytes(image_bytes)
        with Image.open(original) as image:
            image.load()
            full = ROOT / ('assets/images/web/' + name + '.webp')
            thumb = ROOT / ('assets/images/web/' + name + '-thumb.webp')
            full.parent.mkdir(parents=True, exist_ok=True)
            write_webp(image, full, 1440, 82)
            write_webp(image, thumb, 480, 78)
            print(json.dumps({'name': name, 'sha256': digest, 'dimensions': image.size, 'bytes': len(image_bytes), 'webBytes': full.stat().st_size, 'thumbnailBytes': thumb.stat().st_size}))

if __name__ == '__main__':
    main()
