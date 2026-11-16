"""Focused regressions for the lost-weapon repair, no network or game mutations."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location('repair', Path(__file__).with_name('repair-pilot.py'))
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)


class ExtractionTest(unittest.TestCase):
    def sheet(self):
        im = Image.new('RGB', (600, 300), (0, 240, 0))
        d = ImageDraw.Draw(im)
        d.rectangle((80, 40, 180, 250), fill=(90, 65, 40))
        d.rectangle((170, 100, 350, 110), fill=(120, 110, 85))
        d.polygon([(340, 75), (380, 70), (390, 145), (340, 130)], fill=(100, 110, 100))
        d.rectangle((470, 40, 550, 250), fill=(100, 80, 60))
        return im

    def read(self, im):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'sheet.png'
            im.save(path)
            return repair.read_sheet(path)

    def test_weapon_crosses_nominal_cell_without_clipping_or_neighbour(self):
        rgb, labels = self.read(self.sheet())
        im, box, _, _ = repair.extract(rgb, labels, {'seed': [120, 150]})
        self.assertEqual(box[2], 391)  # axe extends beyond the 300px grid boundary
        self.assertLess(box[2], 470)  # never includes the next body
        self.assertEqual(im.getpixel((380 - box[0], 100 - box[1]))[3], 255)

    def test_muted_green_bronze_survives_keying(self):
        im = self.sheet()
        ImageDraw.Draw(im).rectangle((100, 100, 150, 160), fill=(90, 135, 95))
        rgb, labels = self.read(im)
        fig, box, _, _ = repair.extract(rgb, labels, {'seed': [120, 150]})
        self.assertEqual(fig.getpixel((125 - box[0], 125 - box[1]))[3], 255)

    def test_bad_background_seed_is_rejected(self):
        rgb, labels = self.read(self.sheet())
        with self.assertRaises(ValueError):
            repair.extract(rgb, labels, {'seed': [20, 20]})

    def test_idle_head_and_weapon_do_not_stretch(self):
        specs = json.loads(Path(__file__).with_name('repair-pilot.json').read_text())
        with tempfile.TemporaryDirectory() as tmp:
            for key, hero in specs.items():
                report = repair.build(key, hero, Path(tmp))
                im = Image.open(Path(tmp) / f'gen-{key}.png').convert('RGBA')
                w = im.width // 20
                idle = im.crop((0, 0, w, im.height)).tobytes()
                if report.get('idleDrawnFrames'):
                    poses=[im.crop((i*w,0,(i+1)*w,im.height)).tobytes() for i in range(4)]
                    self.assertEqual(len(set(poses)),report['idleDrawnFrames'])
                    self.assertEqual(poses[1],poses[3])
                    for i in range(4):
                        box=im.crop((i*w,0,(i+1)*w,im.height)).getbbox()
                        self.assertGreater(box[0],1);self.assertLess(box[2],w-1)
                        self.assertEqual(box[3],report['feet'])
                else:
                    for i in (1, 2, 3, 12):
                        self.assertEqual(idle, im.crop((i*w, 0, (i+1)*w, im.height)).tobytes(), (key, i))
                self.assertTrue(all(not f['faceRetouch'] for f in report['frames']))


if __name__ == '__main__':
    unittest.main()
