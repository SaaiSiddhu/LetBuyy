"""Build the site's custom Lottie from its licensed Inter outlines.

Authoring dependencies: fonttools + brotli. No authoring dependency ships to users.
Run from any directory: python3 apps/marketing/web/scripts/generate-globe-finale-lottie.py
"""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen

ROOT = Path(__file__).resolve().parents[1]
FONT = TTFont(ROOT / 'public/fonts/Inter-Variable.woff2')
CMAP = FONT.getBestCmap()
UNITS = FONT['head'].unitsPerEm
FPS, INTRO_END, LOOP_END = 60, 156, 636


class LottiePen(BasePen):
    def __init__(self, glyphs, scale, offset=0):
        super().__init__(glyphs)
        self.scale, self.offset, self.contours = scale, offset, []

    def point(self, p):
        return [round(p[0] * self.scale + self.offset, 3), round(-p[1] * self.scale, 3)]

    def _moveTo(self, p):
        self.path = {'i': [[0, 0]], 'o': [[0, 0]], 'v': [self.point(p)], 'c': True}

    def _lineTo(self, p):
        self.path['v'].append(self.point(p))
        self.path['i'].append([0, 0])
        self.path['o'].append([0, 0])

    def _curveToOne(self, a, b, end):
        a, b, end = self.point(a), self.point(b), self.point(end)
        last = self.path['v'][-1]
        self.path['o'][-1] = [round(a[i] - last[i], 3) for i in range(2)]
        self.path['v'].append(end)
        self.path['i'].append([round(b[i] - end[i], 3) for i in range(2)])
        self.path['o'].append([0, 0])

    def _qCurveToOne(self, control, end):
        start = self._getCurrentPoint()
        a = tuple(start[i] + 2 / 3 * (control[i] - start[i]) for i in range(2))
        b = tuple(end[i] + 2 / 3 * (control[i] - end[i]) for i in range(2))
        self._curveToOne(a, b, end)

    def _closePath(self):
        if self.path['v'][-1] == self.path['v'][0] and len(self.path['v']) > 1:
            self.path['i'][0] = self.path['i'].pop()
            self.path['o'].pop()
            self.path['v'].pop()
        self.contours.append(self.path)

    def _endPath(self):
        self.path['c'] = False
        self.contours.append(self.path)


def fixed(value):
    return {'a': 0, 'k': value}


def animate(keys):
    frames = []
    for i, (time, value) in enumerate(keys):
        frame = {'t': time, 's': value}
        if i < len(keys) - 1:
            frame.update(e=keys[i + 1][1], o={'x': [.2], 'y': [0]}, i={'x': [.33], 'y': [1]})
        frames.append(frame)
    return {'a': 1, 'k': frames}


def gradient(offset):
    colors = [(0, [196, 181, 253]), (.25, [125, 211, 252]), (.5, [94, 234, 212]),
              (.75, [125, 211, 252]), (1, [196, 181, 253])]
    stops = [value for position, rgb in colors for value in [position, *[round(c / 255, 5) for c in rgb]]]
    def flow(x):
        return animate([(0, [x, -100]), (INTRO_END, [x, -100]),
                        ((INTRO_END + LOOP_END) / 2, [x - 350, -100]), (LOOP_END, [x, -100])])
    return {'ty': 'gf', 'nm': 'LetBuyy violet blue teal', 'o': fixed(100), 'r': 1, 't': 1,
            'g': {'p': 5, 'k': fixed(stops)}, 's': flow(-offset), 'e': flow(1200 - offset)}


def layer(name, paths, x, baseline, start, duration, index):
    shapes = [{'ty': 'sh', 'nm': 'Inter outline', 'ks': fixed(path), 'hd': False} for path in paths]
    shapes.append(gradient(x))
    return {'ddd': 0, 'ind': index, 'ty': 4, 'nm': name, 'sr': 1,
            'ks': {'o': animate([(start, [0]), (start + duration, [100])]),
                   'r': fixed(0), 'p': animate([(start, [x, baseline + 24, 0]),
                                               (start + duration, [x, baseline, 0])]),
                   'a': fixed([0, 0, 0]), 's': fixed([100, 100, 100])},
            'shapes': shapes, 'ip': 0, 'op': LOOP_END + 1, 'st': 0, 'bm': 0}


layers = []
brand = 'LetBuyy'
glyphs = FONT.getGlyphSet(location={'wght': 800})
tracking = -.035 * UNITS
scale = 1000 / (sum(glyphs[CMAP[ord(c)]].width for c in brand) + tracking * (len(brand) - 1))
x = 100
for index, letter in enumerate(brand):
    glyph = glyphs[CMAP[ord(letter)]]
    pen = LottiePen(glyphs, scale)
    glyph.draw(pen)
    layers.append(layer(f'Brand {index + 1}: {letter}', pen.contours, x, 270,
                        (380 + index * 135) * FPS / 1000, 180 * FPS / 1000, index + 1))
    x += (glyph.width + tracking) * scale

subtitle = 'Sell worldwide'
glyphs = FONT.getGlyphSet(location={'wght': 700})
scale, tracking = 100 / UNITS, -.025 * UNITS
width = (sum(glyphs[CMAP[ord(c)]].width for c in subtitle) + tracking * (len(subtitle) - 1)) * scale
x, paths = 0, []
for letter in subtitle:
    glyph = glyphs[CMAP[ord(letter)]]
    pen = LottiePen(glyphs, scale, x)
    glyph.draw(pen)
    paths.extend(pen.contours)
    x += (glyph.width + tracking) * scale
layers.append(layer('Sell worldwide', paths, (1200 - width) / 2, 415, 90, 42, 8))

animation = {'v': '5.13.0', 'fr': FPS, 'ip': 0, 'op': LOOP_END + 1, 'w': 1200, 'h': 480,
             'nm': 'LetBuyy — Sell worldwide', 'ddd': 0, 'assets': [], 'layers': layers,
             'markers': [{'tm': INTRO_END, 'cm': 'ambient-gradient-loop', 'dr': LOOP_END - INTRO_END}]}
target = ROOT / 'public/animations/letbuyy-finale-v1.json'
target.write_text(json.dumps(animation, separators=(',', ':')) + '\n')
print(f'{target}: {target.stat().st_size} bytes; {len(layers)} vector layers')
