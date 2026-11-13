#!/usr/bin/env python3
"""Post-process an Expo web export for the showcase site.

1. Git and Vercel skip folders named node_modules, where the export puts icon
   fonts and navigation images: move assets/node_modules -> assets/nm.
2. Any bundle whose contents change gets a new file name (content hash), and
   every reference to it is updated, so browsers never reuse a stale copy
   (bundles are cached for a year).
3. Sets the browser tab title.

Usage: fix-web-export.py <export dir> <title>
"""
import hashlib, os, re, shutil, sys

out, title = sys.argv[1], sys.argv[2]
assets = os.path.join(out, 'assets')
if os.path.isdir(os.path.join(assets, 'node_modules')):
    shutil.move(os.path.join(assets, 'node_modules'), os.path.join(assets, 'nm'))

js_dir = os.path.join(out, '_expo', 'static', 'js', 'web')
renames = {}
for name in sorted(os.listdir(js_dir)):
    p = os.path.join(js_dir, name)
    s = open(p, encoding='utf-8').read()
    t = s.replace('assets/node_modules/', 'assets/nm/')
    if t != s:
        open(p, 'w', encoding='utf-8').write(t)
        renames[name] = None

# Rename changed files (and anything that references a renamed file) until stable.
texts = lambda: [os.path.join(js_dir, n) for n in os.listdir(js_dir)] + [os.path.join(out, 'index.html')]
changed = set(renames)
while changed:
    new_changed = set()
    for old in changed:
        p = os.path.join(js_dir, old)
        if not os.path.exists(p):
            continue  # already renamed earlier in this pass
        digest = hashlib.md5(open(p, 'rb').read()).hexdigest()[:12]
        base = re.sub(r'-[0-9a-f]{12,32}\.js$', '', old)
        new = f'{base}-{digest}.js'
        if new == old:
            continue
        os.rename(p, os.path.join(js_dir, new))
        for f in texts():
            s = open(f, encoding='utf-8').read()
            if old in s:
                open(f, 'w', encoding='utf-8').write(s.replace(old, new))
                if f.endswith('.js') and os.path.basename(f) != new:
                    new_changed.add(os.path.basename(f))
        new_changed.discard(old)
    changed = new_changed

idx = os.path.join(out, 'index.html')
s = open(idx, encoding='utf-8').read()
open(idx, 'w', encoding='utf-8').write(re.sub(r'<title>[^<]*</title>', f'<title>{title}</title>', s))
print('post-processed', out)
