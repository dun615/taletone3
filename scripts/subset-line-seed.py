# Subsets LINE Seed KR (OFL 1.1) for self-hosting. Run by hand when the source fonts change; CI never runs it.
#
#   pip install fonttools brotli
#   python3 scripts/subset-line-seed.py <dir with LINESeedKR-{Th,Rg,Bd}.woff2 or line-seed-kr-{100,400,700}.woff2>
#
# Kept: ASCII, Latin-1, general punctuation, CJK symbols and full-width forms, the 2,350 Hangul syllables of
# KS X 1001 (everyday Korean), and every other character the site's data and sources use. Copy edits rarely need
# a re-run; a missing syllable falls back to the next font in the stack.
import glob, os, sys
from fontTools import subset

src_dir = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
chars = set(chr(c) for c in range(0x20, 0x7f)) | set(chr(c) for c in range(0xa0, 0x100))
chars |= set(chr(c) for c in range(0x2000, 0x2070)) | set(chr(c) for c in range(0x3000, 0x3040)) | set(chr(c) for c in range(0xff01, 0xff5f))
for c in range(0xac00, 0xd7a4):
    try:
        if len(chr(c).encode('euc-kr')) == 2: chars.add(chr(c))
    except UnicodeEncodeError:
        pass
for pattern in ['assets/data/*.json', 'src/**/*.*', 'scripts/*.mjs']:
    for path in glob.glob(os.path.join(root, pattern), recursive=True):
        with open(path, encoding='utf-8', errors='ignore') as fh:
            for ch in fh.read():
                if ord(ch) >= 0x80 and not (0x3040 <= ord(ch) <= 0x30ff or 0x3400 <= ord(ch) <= 0x9fff):
                    chars.add(ch)
text = ''.join(sorted(chars))
for weight, names in {'100': ['line-seed-kr-100', 'LINESeedKR-Th'], '400': ['line-seed-kr-400', 'LINESeedKR-Rg'], '700': ['line-seed-kr-700', 'LINESeedKR-Bd']}.items():
    src = next(p for n in names for p in [os.path.join(src_dir, n + '.woff2')] if os.path.exists(p))
    out = os.path.join(root, 'assets', 'fonts', f'line-seed-kr-{weight}.woff2')
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
    font = subset.load_font(src, opts); sub = subset.Subsetter(opts); sub.populate(text=text); sub.subset(font)
    subset.save_font(font, out, opts)
    print(out, os.path.getsize(out), 'bytes', len(text), 'chars')
