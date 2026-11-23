# Subsets the site's rounded faces for self-hosting. Run by hand when the source fonts change or when
# `npm test` says the site uses a character a subset lacks; CI never runs it.
#
#   pip install fonttools brotli
#   python3 scripts/subset-fonts.py <dir with TaletoneLatin-{Thin,Regular,Bold}.woff2, Manjari-{Thin,Regular,Bold}.woff2,
#                                    NanumSquareRound{L,R,B,EB}.woff2, MPLUSRounded1c-{Light,Regular,Medium}.woff2>
#   (the design system's fonts/ folder holds them all)
#
#   TALETONE Latin (SIL OFL)                 -> assets/fonts/taletone-latin-{100,400,700}.woff2: Manjari drawn at the size of
#                                               NanumSquareRound (106%, Bold 104%), for every Latin letter and digit
#   Manjari (English, SIL OFL)               -> assets/fonts/manjari-{100,400,700}.woff2: Latin and punctuation
#   NanumSquareRound (Korean, Naver licence) -> assets/fonts/nanum-square-round-{300,400,700,800}.woff2: Latin, punctuation,
#                                               the 2,350 Hangul syllables of KS X 1001 and every other character
#                                               the site's data and sources use (not Japanese)
#   M PLUS Rounded 1c (Japanese, SIL OFL)    -> assets/fonts/mplus-rounded-{300,400,500}.woff2: Latin, punctuation,
#                                               all kana and every kanji the site's data and sources use
#                                               (the Japanese pages only)
#
# What each subset holds is written to scripts/font-subsets.json; tests/fonts.test.mjs checks the site against it.
import glob, json, os, sys
from fontTools import subset

src_dir = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = lambda a, b: set(chr(c) for c in range(a, b))
latin = rng(0x20, 0x7f) | rng(0xa0, 0x100) | rng(0x2000, 0x2070) | rng(0x20a0, 0x20c0) | rng(0x2190, 0x2200)
cjk_marks = rng(0x3000, 0x3040) | rng(0xff01, 0xff5f)
japanese = lambda cp: 0x3000 <= cp <= 0x30ff or 0x3400 <= cp <= 0x9fff or 0xf900 <= cp <= 0xfaff or 0xff00 <= cp <= 0xffef
used = set()
for pattern in ['assets/data/*.json', 'src/**/*.*', 'scripts/*.mjs']:
    for path in glob.glob(os.path.join(root, pattern), recursive=True):
        with open(path, encoding='utf-8', errors='ignore') as fh:
            used |= set(fh.read())
ksx = set()
for c in range(0xac00, 0xd7a4):
    try:
        if len(chr(c).encode('euc-kr')) == 2: ksx.add(chr(c))
    except UnicodeEncodeError:
        pass
sets = {
    'taletone-latin': latin,
    'manjari': latin,
    'nanum-square-round': latin | cjk_marks | ksx | set(ch for ch in used if ord(ch) >= 0x80 and not japanese(ord(ch))),
    'mplus-rounded': latin | cjk_marks | rng(0x3040, 0x3100) | rng(0x31f0, 0x3200) | set(ch for ch in used if japanese(ord(ch))),
}
files = {
    'taletone-latin': {'100': 'TaletoneLatin-Thin', '400': 'TaletoneLatin-Regular', '700': 'TaletoneLatin-Bold'},
    'manjari': {'100': 'Manjari-Thin', '400': 'Manjari-Regular', '700': 'Manjari-Bold'},
    'nanum-square-round': {'300': 'NanumSquareRoundL', '400': 'NanumSquareRoundR', '700': 'NanumSquareRoundB', '800': 'NanumSquareRoundEB'},
    'mplus-rounded': {'300': 'MPLUSRounded1c-Light', '400': 'MPLUSRounded1c-Regular', '500': 'MPLUSRounded1c-Medium'},
}
covered = {}
for family, weights in files.items():
    text = ''.join(sorted(sets[family]))
    for weight, name in weights.items():
        src = os.path.join(src_dir, name + '.woff2')
        out = os.path.join(root, 'assets', 'fonts', f'{family}-{weight}.woff2')
        opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
        font = subset.load_font(src, opts)
        # (characters the site uses that the face itself does not have: they fall back to the next face in the stack)
        absent = sets[family] - set(chr(c) for c in font.getBestCmap())
        sub = subset.Subsetter(opts); sub.populate(text=text); sub.subset(font)
        cmap = set(chr(c) for c in font.getBestCmap())
        # (NanumSquareRound ExtraBold (800) is only for the one largest heading of a screen: it is kept apart, so the
        # characters it lacks do not take away from what the family's other weights hold for the running text)
        key = family + (' 800' if weight == '800' else '')
        covered[key + ' (not in the face)'] = (set(covered.get(key + ' (not in the face)', '')) | absent) & used
        subset.save_font(font, out, opts)
        # (what every weight of the family holds)
        covered[key] = (set(covered[key]) if key in covered else sets[family]) & cmap
        print(out, os.path.getsize(out), 'bytes', len(cmap), 'characters')
# TALETONE Latin for Korean lines (taletone-latin-ko-*): the Korean pages track their lines tighter (body -0.01em,
# titles -0.02em, the largest heading -0.03em) and CSS cannot track the Latin of a line apart from its Hangul, so this
# copy carries its own spacing in its advances: capitals +0.05em, small letters +0.025em, digits +0.015em. In those
# lines that comes to the design system's spacing for Latin among Korean: a word in capitals about +0.04em, a word in
# mixed case about +0.01em, digits about 0. (English pages use TALETONE Latin as it is.)
import unicodedata
from fontTools.ttLib import TTFont
KO_TRACK = {'Lu': 0.05, 'Ll': 0.025, 'Nd': 0.015}
for weight in files['taletone-latin']:
    f = TTFont(os.path.join(root, 'assets', 'fonts', f'taletone-latin-{weight}.woff2'))
    upm = f['head'].unitsPerEm; hmtx = f['hmtx'].metrics; done = set()
    for cp, gname in f.getBestCmap().items():
        add = KO_TRACK.get(unicodedata.category(chr(cp)), 0)
        if add and gname not in done:
            adv, lsb = hmtx[gname]; hmtx[gname] = (adv + round(add * upm), lsb); done.add(gname)
    f['hhea'].advanceWidthMax = max(a for a, _ in hmtx.values())
    out = os.path.join(root, 'assets', 'fonts', f'taletone-latin-ko-{weight}.woff2'); f.flavor = 'woff2'; f.save(out)
    print(out, os.path.getsize(out), 'bytes,', len(done), 'glyphs tracked')
with open(os.path.join(root, 'scripts', 'font-subsets.json'), 'w', encoding='utf-8') as fh:
    json.dump({k: ''.join(sorted(v)) for k, v in covered.items()}, fh, ensure_ascii=False, indent=0)
    fh.write('\n')
