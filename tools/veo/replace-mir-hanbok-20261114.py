"""Install user-requested hanbok revision; preserve attempted source fingerprints."""
from pathlib import Path
from PIL import Image
import json, shutil, hashlib, os, datetime

ROOT = Path(__file__).resolve().parents[2]
LEDGER = Path('C:/Users/my/Documents/Codex/2026-11-06/windows-pc-claude-code-claude-code')
OUT = Path('C:/Users/my/Documents/Codex/2026-11-13/d-flutter-arrow-game-one/outputs')
SOURCE = Path('C:/Users/my/.codex/generated_images/01a1d3a8-4428-7e93-8874-2102ea19b75e/exec-ad4a07ae-30e2-4043-b9c5-b4bb09029c92.png')
KEY = 'w-97-goguryeo-mir'
JOB = 't1-goguryeo-mir-opaque-20261114'
ARCHIVE = ROOT / 'assets_src/realm/retired/mir-high-collar-20261114'
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def atomic(p, data):
    temp = p.with_name(p.name + '.hanbok.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    os.replace(temp, p)

P = LEDGER / 'outputs/veo-production-queue.json'
S = LEDGER / 'outputs/veo-production-state.json'
LOCK = Path(str(S) + '.lock')
fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
try:
    q = json.loads(P.read_text('utf8')); s = json.loads(S.read_text('utf8'))
    j = next(j for j in q['jobs'] if j['id'] == JOB)
    a = next(a for a in s['attempts'] if a['jobId'] == JOB)
    assert a['status'] == 'held'
    assert sha(j['promptPath']) == j['promptSha256'] == a['promptSha256']
    old = ROOT / f'public/realm/awaken-hd/{KEY}.jpg'
    assert sha(old) == a['inputSha256'] == j['inputSha256'], 'Source changed; reconcile before replacing'
    assert sha(a['filePath']) == a['fileSha256']
    assert not ARCHIVE.exists(), 'Already installed or archive occupied; inspect instead of overwriting'
    ARCHIVE.mkdir(parents=True)
    shutil.copy2(P, ARCHIVE / 'queue-before.json')
    shutil.copy2(S, ARCHIVE / 'state-before.json')
    for folder in ['awaken-hd', 'awaken']:
        dest = ARCHIVE / folder
        dest.mkdir()
        shutil.copy2(ROOT / f'public/realm/{folder}/{KEY}.jpg', dest / f'{KEY}.jpg')
    shutil.copy2(ROOT / f'assets_src/realm/awaken/{KEY}.png', ARCHIVE / f'{KEY}-source.png')
    archived = ARCHIVE / f'awaken-hd/{KEY}.jpg'
    assert sha(archived) == a['inputSha256']
    for record in [a, j]:
        record['historicalInputPath'] = record['inputPath']
        record['inputPath'] = str(archived)
    a['sourceSupersededBy'] = str(ROOT / f'assets_src/realm/awaken/{KEY}-hanbok-20261114.png')
    atomic(P, q); atomic(S, s)
    for name in [f'{KEY}.png', f'{KEY}-hanbok-20261114.png']:
        shutil.copy2(SOURCE, ROOT / 'assets_src/realm/awaken' / name)
    shutil.copy2(SOURCE, OUT / 'mir-awaken1-hanbok-20261114.png')
    shutil.copy2(ROOT / f'assets_src/realm/awaken/{KEY}-hanbok-20261114.prompt.txt', OUT / 'mir-awaken1-hanbok-20261114.prompt.txt')
    im = Image.open(SOURCE).convert('RGB')
    for folder, size in [('awaken-hd', 900), ('awaken', 320)]:
        im.resize((size,size), Image.Resampling.LANCZOS).save(ROOT / f'public/realm/{folder}/{KEY}.jpg', quality=88)
    receipt = dict(tool='built-in image_gen', imageCalls=1, source=str(SOURCE), generatedSha256=sha(SOURCE),
        installedHdSha256=sha(old), archivedAttemptSourceSha256=sha(archived), previousAttempt=a['id'],
        videoApplied=False, tier2Changed=False, createdAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
    atomic(ROOT / f'assets_src/realm/awaken/{KEY}-hanbok-20261114.receipt.json', receipt)
    print(json.dumps(receipt))
finally:
    os.close(fd)
    LOCK.unlink()
