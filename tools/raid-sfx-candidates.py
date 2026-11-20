"""CODEX50-8: build review-only CC BY SFX, preserving original bytes.

Requires existing Python 3.9+, curl.exe (Windows TLS certificate verification),
and an existing FFmpeg. No dependencies are installed. Downloads are sequential,
at least 2.1 seconds apart, with at most two attempts. Never accesses OGA.
"""
import argparse
import collections
import hashlib
import html
import json
import math
import re
import shutil
import subprocess
import time
import wave
from pathlib import Path

TARGET = -18.0
PEAK_CEILING = -0.1
LAST_REQUEST = 0.0


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def ffmpeg(exe, args):
    result = subprocess.run([exe, '-nostdin', '-hide_banner', '-threads', '1', *args],
                            capture_output=True, text=True, encoding='utf-8', errors='replace')
    if result.returncode:
        raise RuntimeError(result.stderr[-4000:])
    return result.stderr


def loudness(exe, path, prefix=''):
    log = ffmpeg(exe, ['-i', str(path), '-af', prefix + 'loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json',
                       '-f', 'null', '-'])
    blocks = re.findall(r'\{\s*"input_i"[\s\S]*?\}', log)
    if not blocks:
        raise RuntimeError('FFmpeg did not return loudness JSON: ' + log[-2000:])
    return json.loads(blocks[-1])


def download(url, target, headers):
    global LAST_REQUEST
    if target.exists():
        if not headers.exists():
            raise RuntimeError('Existing original has no HTTP evidence; refusing overwrite: ' + str(target))
        return 'reused-existing-bytes'
    if not url.startswith('https://soundbible.com/'):
        raise ValueError('Only prepared SoundBible URLs permitted')
    temporary = target.with_suffix(target.suffix + '.partial')
    for attempt in range(2):
        time.sleep(max(0, 2.1 - (time.monotonic() - LAST_REQUEST)))
        LAST_REQUEST = time.monotonic()
        r = subprocess.run(['curl.exe', '--fail', '--location', '--max-time', '90',
                            '--connect-timeout', '20', '--user-agent', 'Codex/50-SFX-candidate-review',
                            '--dump-header', str(headers), '--output', str(temporary), url],
                           capture_output=True, text=True)
        if r.returncode == 0:
            temporary.replace(target)
            return 'downloaded'
        if attempt == 1:
            raise RuntimeError('Download failed after two attempts: ' + url + '\n' + r.stderr)
    raise AssertionError('unreachable')


def wav_info(path):
    with wave.open(str(path), 'rb') as w:
        return dict(durationSeconds=w.getnframes() / w.getframerate(), sampleRate=w.getframerate(),
                    channels=w.getnchannels(), sampleWidthBytes=w.getsampwidth(), frames=w.getnframes())


def build(prep, dest, exe):
    source = json.loads(prep.read_text(encoding='utf-8-sig'))
    assert len(source['candidates']) == 18
    assert set(collections.Counter(c['category'] for c in source['candidates']).values()) == {3}
    assert all(c['selectedLicense'] == 'CC BY 3.0' for c in source['candidates'])
    for folder in ['originals', 'normalized', 'evidence', 'logs']:
        (dest / folder).mkdir(parents=True, exist_ok=True)
    snapshot = dest / 'evidence' / 'source-prep.json'
    if snapshot.exists() and sha(snapshot) != sha(prep):
        raise RuntimeError('Different existing source snapshot; refusing to replace')
    if not snapshot.exists():
        shutil.copyfile(prep, snapshot)
    for source_path in [source['siteAccessReview']['robotsLocalCopy'],
                        *[c['sourcePageSaved'] for c in source['candidates']]]:
        source_path = Path(source_path)
        target = dest / 'evidence' / source_path.name
        if target.exists() and sha(source_path) != sha(target):
            raise RuntimeError('Evidence name collision: ' + str(target))
        if not target.exists():
            shutil.copyfile(source_path, target)
    manifest = dict(task='CODEX50-8 review-only SFX candidates', accessed=source['accessed'],
                    measuredAt=time.strftime('%Y-%m-%dT%H:%M:%S%z'), targetLufs=TARGET,
                    toleranceLu=0.3, truePeakTargetDbtp=-1.5,
                    evidenceGrade='A: official metadata/license; B: local audio measurements',
                    installedCandidates=0, listened=False,
                    limitations=['사람의 실청취·게임 적합도·일반/치명 강약 차이는 미검증.',
                                 '분류는 공식 설명 기반 예비 분류이며 모든 후보를 채택할 필요 없음.',
                                 '긴 원본은 임의 자르지 않았고 연속 타격·긴 비명 등 원본 전체를 보존.',
                                 '게임에 설치하지 않음. 사용자가 고른 뒤 별도 적용.'],
                    ffmpegVersion=ffmpeg(exe, ['-version']).strip(),
                    ffmpegExecutable=exe, sourcePrepSha256=sha(prep),
                    licenseReview=source['licenseReview'], siteAccessReview=source['siteAccessReview'],
                    candidates=[])
    # ffmpeg -version is written on stdout, recorded explicitly here.
    manifest['ffmpegVersion'] = subprocess.check_output([exe, '-version'], text=True).splitlines()[0]
    for c in source['candidates']:
        print('PROCESS ' + c['id'], flush=True)
        original = dest / 'originals' / (c['id'] + Path(c['originalFilename']).suffix)
        header = dest / 'evidence' / (c['id'] + '-download-headers.txt')
        disposition = download(c['directDownloadUrl'], original, header)
        header_text = header.read_text(encoding='utf-8', errors='replace')
        mime = re.findall(r'^content-type:\s*(.+)$', header_text, re.I | re.M)
        mime = mime[-1].strip() if mime else ''
        magic = original.read_bytes()[:12]
        is_wav = magic[:4] == b'RIFF' and magic[8:12] == b'WAVE'
        is_mp3 = magic[:3] == b'ID3' or (len(magic) > 1 and magic[0] == 255 and magic[1] & 224 == 224)
        if 'html' in mime.lower() or not (is_wav or is_mp3):
            raise RuntimeError('Not expected audio bytes: ' + c['id'] + ': ' + mime + ' ' + repr(magic))
        # A successful full decode is mandatory, even when headers look valid.
        decode_log = ffmpeg(exe, ['-i', str(original), '-f', 'null', '-'])
        (dest / 'logs' / (c['id'] + '-decode.log')).write_text(decode_log, encoding='utf-8')
        decoded = dest / 'normalized' / (c['id'] + '-decode-temporary.wav')
        ffmpeg(exe, ['-y', '-i', str(original), '-ar', '48000', '-c:a', 'pcm_s16le', str(decoded)])
        info = wav_info(decoded)
        decoded.unlink()
        first = loudness(exe, original)
        pad = 0.0
        if not math.isfinite(float(first['input_i'])):
            # BS.1770 needs a complete 400ms block. Add only tail silence,
            # never repeat the sound or invent a crop point.
            pad = max(0, 3.0 - info['durationSeconds'])
            if pad <= 0:
                raise RuntimeError('Non-finite LUFS despite >=3s source: ' + c['id'])
            first = loudness(exe, original, 'apad=pad_dur=' + str(pad) + ',')
        if not math.isfinite(float(first['input_i'])):
            raise RuntimeError('LUFS still non-finite with silence padding: ' + c['id'])
        filt = ('apad=pad_dur=' + str(pad) + ',' if pad else '')
        filt += ('loudnorm=I=-18:TP=-1.7:LRA=11:measured_I={input_i}:'
                 'measured_TP={input_tp}:measured_LRA={input_lra}:'
                 'measured_thresh={input_thresh}:offset={target_offset}:linear=true:print_format=json').format(**first)
        output = dest / 'normalized' / c['candidateFilename']
        # Only script-owned derived candidates are regenerated. Originals are never overwritten.
        ffmpeg(exe, ['-y', '-i', str(original), '-af', filt, '-ar', '48000', '-c:a', 'pcm_s16le', str(output)])
        measurements = [loudness(exe, output)]
        corrections = []
        for attempt in range(2):
            measured = measurements[-1]
            delta = TARGET - float(measured['input_i'])
            if abs(delta) <= 0.3 and float(measured['input_tp']) <= -1.49:
                break
            # A short transient can hit loudnorm's peak ceiling before reaching
            # its integrated target. A documented limiter corrects this within
            # the two-correction budget. -1.7dB leaves reconstruction margin.
            use_limiter = float(measured['input_tp']) + delta > -1.7
            corrective_filter = 'volume=' + str(delta) + 'dB'
            if use_limiter:
                corrective_filter += ',alimiter=limit=0.8222426499:attack=0.1:release=50:level=false:latency=true'
            temporary = dest / 'normalized' / (c['id'] + '-correction-temporary.wav')
            ffmpeg(exe, ['-y', '-i', str(output), '-af', corrective_filter,
                         '-ar', '48000', '-c:a', 'pcm_s16le', str(temporary)])
            temporary.replace(output)
            corrections.append(dict(attempt=attempt + 1, gainDb=delta, limiter=use_limiter,
                                    limiterCeilingDbfs=-1.7 if use_limiter else None))
            measurements.append(loudness(exe, output))
        final = measurements[-1]
        row = {k: c[k] for k in ['id', 'category', 'title', 'author', 'sourcePage', 'pageSha256',
                                  'selectedLicense', 'primaryLicensePage', 'primaryLegalCode', 'accessed',
                                  'evidenceGrade', 'classificationBasis', 'originalFilename', 'directDownloadUrl']}
        row.update(originalPath=original.relative_to(dest).as_posix(), candidatePath=output.relative_to(dest).as_posix(),
                   originalSha256=sha(original), candidateSha256=sha(output), originalBytes=original.stat().st_size,
                   candidateBytes=output.stat().st_size, originalMime=mime, signature='RIFF/WAVE' if is_wav else 'MPEG audio',
                   fullDecodePassed=True, downloadDisposition=disposition, originalAudio=info,
                   candidateAudio=wav_info(output), tailSilenceAddedSeconds=pad, trimmed=False, repeated=False,
                   firstPass=first, finalMeasured=final, measurements=measurements, corrections=corrections,
                   measuredLufs=float(final['input_i']), measuredTruePeakDbtp=float(final['input_tp']),
                   lufsWithinTolerance=abs(float(final['input_i']) - TARGET) <= 0.3,
                   truePeakWithinCeiling=float(final['input_tp']) <= -1.49,
                   listened=False, installed=False,
                   transformation='2-pass loudnorm -18 LUFS / TP processing -1.7 dBTP (verification ceiling -1.5) / LRA 11; WAV PCM16 48kHz; '
                   + ('tail silence %.6fs added for finite BS.1770 measurement; ' % pad if pad else '')
                   + 'no trim, no repeated sound' + ('; corrective gain: ' + str(corrections) if corrections else ''))
        manifest['candidates'].append(row)
        save_json(dest / 'manifest.json', manifest)
        print('DONE %s duration=%.3fs LUFS=%.2f TP=%.2f' %
              (c['id'], row['candidateAudio']['durationSeconds'], row['measuredLufs'], row['measuredTruePeakDbtp']), flush=True)
    manifest['counts'] = dict(collections.Counter(c['category'] for c in manifest['candidates']))
    manifest['actualCandidateCount'] = len(manifest['candidates'])
    manifest['allWithinTolerance'] = all(c['lufsWithinTolerance'] for c in manifest['candidates'])
    manifest['lufsPassedCount'] = sum(c['lufsWithinTolerance'] for c in manifest['candidates'])
    manifest['truePeakPassedCount'] = sum(c['truePeakWithinCeiling'] for c in manifest['candidates'])
    manifest['originalTotalBytes'] = sum(c['originalBytes'] for c in manifest['candidates'])
    manifest['candidateTotalBytes'] = sum(c['candidateBytes'] for c in manifest['candidates'])
    save_json(dest / 'manifest.json', manifest)
    render_html(dest, manifest)
    return manifest


def render_html(dest, manifest):
    e = html.escape
    sections = []
    for category in dict.fromkeys(c['category'] for c in manifest['candidates']):
        rows = []
        for c in [x for x in manifest['candidates'] if x['category'] == category]:
            change = '음량 조정, 48kHz WAV(16비트)'
            if any(x.get('limiter') or 'alimiter' in x.get('filter', '') for x in c['corrections']):
                change += ', 피크 제한'
            if c['tailSilenceAddedSeconds']:
                change += ', 뒤 무음 %.3f초 추가' % c['tailSilenceAddedSeconds']
            change += '. 자르기·반복·피치·속도 변경 없음.'
            rows.append('<article><h3>' + e(c['id'] + ' · ' + c['title']) + '</h3>'
                        '<audio controls preload="metadata" src="' + e(c['candidatePath']) + '"></audio>'
                        '<p>저자: ' + e(c['author']) + ' · <a href="' + e(c['sourcePage']) + '">공식 원문</a> · '
                        '<a href="' + e(c['primaryLicensePage']) + '">CC BY 3.0</a></p>'
                        '<p>원본 %.3f초 → 후보 %.3f초 · %.2f LUFS · %.2f dBTP</p>' %
                        (c['originalAudio']['durationSeconds'], c['candidateAudio']['durationSeconds'],
                         c['measuredLufs'], c['measuredTruePeakDbtp'])
                        + ('<p><strong>주의: -18 LUFS 허용 범위 미달. 재시도 상한에 따라 보류합니다.</strong></p>'
                           if not c['lufsWithinTolerance'] else '')
                        + '<p>' + e(c['classificationBasis']) + '</p><p class="detail">가공: '
                        + e(change) + '</p></article>')
        sections.append('<section><h2>' + e(category) + '</h2><div class="grid">' + ''.join(rows) + '</div></section>')
    page = '''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>50-8 효과음 후보 18개</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:1240px;margin:24px auto;padding:0 20px;background:#f6f4ee;color:#28251e}h1{font-size:27px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}article{background:white;border:1px solid #c9c3b6;padding:16px;overflow-wrap:anywhere}h3{font-size:17px;margin-top:0}audio{width:100%}.detail{font-size:13px;color:#514b41}a{color:#174f86}</style>
<h1>효과음 후보 · 6종 × 3개</h1><p>게임 미설치 · 사용자가 고른 뒤 적용합니다. 공식 설명에 따른 예비 분류이며 사람의 실청취와 게임 적합도 평가는 아직 하지 않았습니다.</p>
<p>목표 -18 LUFS(허용 ±0.3 LU), 최종 true peak 상한 -0.1 dBTP. 모든 음원은 CC BY 3.0이며 저자·제목·원문·라이선스·가공을 표시합니다. 긴 원본과 연속 소리는 자르지 않았습니다. 짧은 음원은 측정이 유한해지는 경우에만 뒤에 무음을 더했습니다. 같은 소리를 반복하지 않았습니다.</p>
<p><a href="manifest.json">전체 출처·SHA256·실측 JSON</a></p>'''
    page += '<p>출처 조회: ' + e(manifest['accessed']) + ' · 최종 실측: ' + e(manifest['measuredAt']) + '</p>'
    passed = sum(c['lufsWithinTolerance'] for c in manifest['candidates'])
    page += '<p>최종 실측 -18±0.3 LUFS 통과: %d/18.</p>' % passed
    if passed != 18:
        page += '<p>미달 항목은 각 카드에 표시했습니다.</p>'
    (dest / 'index.html').write_text(page + ''.join(sections) + '</html>\n', encoding='utf-8')


def finish_existing(dest, exe):
    """One narrowly approved correction contract; never downloads or rebuilds 15 passing files."""
    manifest_path = dest / 'manifest.json'
    data = json.loads(manifest_path.read_text(encoding='utf-8'))
    history = dest / 'history' / '20261121-peak-contract'
    if history.exists():
        raise RuntimeError('Contract already started; inspect saved history instead of repeating')
    history.mkdir(parents=True)
    shutil.copyfile(manifest_path, history / 'manifest-before.json')
    old_sha = {c['id']: c['candidateSha256'] for c in data['candidates']}
    original_sha = {c['id']: c['originalSha256'] for c in data['candidates']}
    planned = {'hit-normal-1': 1.17, 'embed-3': 0.86, 'embed-1': 3.26}
    for c in data['candidates']:
        if c['id'] in planned:
            shutil.copyfile(dest / c['candidatePath'], history / Path(c['candidatePath']).name)
    journal = dict(reason='Approved correction: replace self-imposed -1.5dBTP criterion with -0.1dBTP; '
                          'two fixed gains, one oversampled short-release limiter for a high-crest transient.',
                   targetLufs=-18, toleranceLu=0.3, peakCeilingDbtp=PEAK_CEILING,
                   preCorrectionManifestSha256=sha(history / 'manifest-before.json'),
                   sourceSha256=original_sha, candidateSha256Before=old_sha, commands=[])
    save_json(history / 'contract.json', journal)
    for c in data['candidates']:
        if c['id'] not in planned:
            continue
        gain = planned[c['id']]
        filt = 'volume=' + str(gain) + 'dB'
        if c['id'] == 'embed-1':
            filt = ('aresample=192000,volume=3.26dB,'
                    'alimiter=limit=0.954992586:attack=0.1:release=1:level=false:latency=true,aresample=48000')
        candidate = dest / c['candidatePath']
        temporary = candidate.with_name(c['id'] + '-contract-temporary.wav')
        args = ['-y', '-i', str(candidate), '-af', filt, '-ar', '48000', '-c:a', 'pcm_s16le', str(temporary)]
        command = [exe, '-nostdin', '-hide_banner', '-threads', '1', *args]
        log = ffmpeg(exe, args)
        log_path = dest / 'logs' / (c['id'] + '-contract-correction.log')
        log_path.write_text(log, encoding='utf-8')
        measured = loudness(exe, temporary)
        measure_args = ['-i', str(temporary), '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']
        # Store the actual raw measurement output as well as the parsed JSON.
        measure_log = ffmpeg(exe, measure_args)
        (dest / 'logs' / (c['id'] + '-contract-measure.log')).write_text(measure_log, encoding='utf-8')
        journal['commands'].append(dict(id=c['id'], command=command, filter=filt, log=log_path.relative_to(dest).as_posix(),
                                        measurementCommand=[exe, '-nostdin', '-hide_banner', '-threads', '1', *measure_args],
                                        measurement=measured))
        save_json(history / 'contract.json', journal)
        temporary.replace(candidate)
        c['measurements'].append(measured)
        c['corrections'].append(dict(contract='20261121-peak-contract', attempt=1, gainDb=gain,
                                    filter=filt, truePeakCeilingDbtp=PEAK_CEILING, measured=measured))
        c.update(finalMeasured=measured, measuredLufs=float(measured['input_i']),
                 measuredTruePeakDbtp=float(measured['input_tp']), candidateSha256=sha(candidate),
                 candidateBytes=candidate.stat().st_size, candidateAudio=wav_info(candidate))
        c['transformation'] += '; approved final correction: ' + filt
        print('CONTRACT %s I=%s TP=%s' % (c['id'], measured['input_i'], measured['input_tp']), flush=True)
        save_json(manifest_path, data)
    data['truePeakTargetDbtp'] = PEAK_CEILING
    data['initialProcessingTruePeakDbtp'] = -1.7
    data['correctionHistory'] = dict(path=history.relative_to(dest).as_posix(),
                                     manifestBeforeSha256=journal['preCorrectionManifestSha256'],
                                     actualCorrections=3, remainingCalculatedCorrectionBudget=1)
    for c in data['candidates']:
        assert sha(dest / c['originalPath']) == original_sha[c['id']], 'Original changed'
        if c['id'] not in planned:
            assert sha(dest / c['candidatePath']) == old_sha[c['id']], 'Passing candidate changed'
        c['lufsWithinTolerance'] = abs(c['measuredLufs'] - TARGET) <= 0.3
        c['truePeakWithinCeiling'] = c['measuredTruePeakDbtp'] <= PEAK_CEILING
    data['lufsPassedCount'] = sum(c['lufsWithinTolerance'] for c in data['candidates'])
    data['truePeakPassedCount'] = sum(c['truePeakWithinCeiling'] for c in data['candidates'])
    data['allWithinTolerance'] = data['lufsPassedCount'] == 18
    data['measuredAt'] = time.strftime('%Y-%m-%dT%H:%M:%S%z')
    save_json(manifest_path, data)
    render_html(dest, data)
    print('CONTRACT COMPLETE LUFS=%d/18 TP=%d/18' % (data['lufsPassedCount'], data['truePeakPassedCount']))


def verify(dest, exe):
    data = json.loads((dest / 'manifest.json').read_text(encoding='utf-8'))
    assert len(data['candidates']) == 18, 'Expected 18 completed candidates'
    assert set(collections.Counter(c['category'] for c in data['candidates']).values()) == {3}
    for c in data['candidates']:
        for key, digest in [('originalPath', 'originalSha256'), ('candidatePath', 'candidateSha256')]:
            assert sha(dest / c[key]) == c[digest], c['id'] + ' SHA mismatch'
        measure_args = ['-i', str(dest / c['candidatePath']), '-af',
                        'loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']
        raw = ffmpeg(exe, measure_args)
        logs = dest / 'logs'
        logs.mkdir(exist_ok=True)
        (logs / (c['id'] + '-final-verification.log')).write_text(raw, encoding='utf-8')
        (logs / (c['id'] + '-final-verification-command.json')).write_text(
            json.dumps([exe, '-nostdin', '-hide_banner', '-threads', '1', *measure_args], indent=2), encoding='utf-8')
        actual = json.loads(re.findall(r'\{\s*"input_i"[\s\S]*?\}', raw)[-1])
        assert math.isfinite(float(actual['input_i'])), c['id'] + ' nonfinite loudness'
        assert abs(float(actual['input_i']) - TARGET) <= 0.3, c['id'] + ' target missed'
        assert float(actual['input_tp']) <= PEAK_CEILING, c['id'] + ' true peak ceiling exceeded'
        assert float(actual['input_i']) == c['measuredLufs'] and float(actual['input_tp']) == c['measuredTruePeakDbtp']
        assert c['selectedLicense'] == 'CC BY 3.0' and not c['installed'] and not c['listened']
        print(c['id'] + ' ' + actual['input_i'] + ' LUFS ' + actual['input_tp'] + ' dBTP')
    page = (dest / 'index.html').read_text(encoding='utf-8')
    assert page.count('<audio ') == 18 and page.count('<section>') == 6
    assert not list((dest / 'normalized').glob('*temporary*'))
    print('PASS: 18 files, 6 x 3, original/candidate SHA, fresh LUFS/TP, HTML references; no game install')


def complete_remaining(dest, exe):
    """The contract's single calculated final trim, only for embed-1."""
    path = dest / 'manifest.json'
    data = json.loads(path.read_text(encoding='utf-8'))
    assert data['correctionHistory']['remainingCalculatedCorrectionBudget'] == 1
    assert [c['id'] for c in data['candidates'] if not c['lufsWithinTolerance']] == ['embed-1']
    history = dest / data['correctionHistory']['path']
    c = next(c for c in data['candidates'] if c['id'] == 'embed-1')
    current = dest / c['candidatePath']
    backup = history / 'embed-1-before-final-trim.wav'
    if backup.exists():
        raise RuntimeError('Final trim already started; refusing repetition')
    shutil.copyfile(current, backup)
    save_json(history / 'manifest-before-final-trim.json', data)
    gain = round(TARGET - c['measuredLufs'], 2)
    filt = ('aresample=192000,volume=' + str(gain) + 'dB,'
            'alimiter=limit=0.977237221:attack=0.1:release=1:level=false:latency=true,aresample=48000')
    temporary = current.with_name('embed-1-final-trim-temporary.wav')
    args = ['-y', '-i', str(current), '-af', filt, '-ar', '48000', '-c:a', 'pcm_s16le', str(temporary)]
    raw = ffmpeg(exe, args)
    (dest / 'logs' / 'embed-1-final-trim.log').write_text(raw, encoding='utf-8')
    measure_args = ['-i', str(temporary), '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']
    raw_measurement = ffmpeg(exe, measure_args)
    (dest / 'logs' / 'embed-1-final-trim-measure.log').write_text(raw_measurement, encoding='utf-8')
    measured = json.loads(re.findall(r'\{\s*"input_i"[\s\S]*?\}', raw_measurement)[-1])
    log_record = dict(command=[exe, '-nostdin', '-hide_banner', '-threads', '1', *args],
                      measurementCommand=[exe, '-nostdin', '-hide_banner', '-threads', '1', *measure_args],
                      measured=measured, filter=filt, gainDb=gain,
                      reasoning='I deficit 0.59LU; unconstrained peak +0.24dBTP, '
                      'limiter -0.2dBFS controls approximately 0.44dB peak; prior ISP overshoot 0.05dB.')
    save_json(history / 'final-trim.json', log_record)
    temporary.replace(current)
    c['measurements'].append(measured)
    c['corrections'].append(dict(contract='20261121-peak-contract', attempt=2, **log_record))
    c.update(finalMeasured=measured, measuredLufs=float(measured['input_i']),
             measuredTruePeakDbtp=float(measured['input_tp']), candidateSha256=sha(current),
             candidateBytes=current.stat().st_size, candidateAudio=wav_info(current))
    c['transformation'] += '; single calculated final trim: ' + filt
    c['lufsWithinTolerance'] = abs(c['measuredLufs'] - TARGET) <= 0.3
    c['truePeakWithinCeiling'] = c['measuredTruePeakDbtp'] <= PEAK_CEILING
    data['correctionHistory']['actualCorrections'] = 4
    data['correctionHistory']['remainingCalculatedCorrectionBudget'] = 0
    data['lufsPassedCount'] = sum(c['lufsWithinTolerance'] for c in data['candidates'])
    data['truePeakPassedCount'] = sum(c['truePeakWithinCeiling'] for c in data['candidates'])
    data['allWithinTolerance'] = data['lufsPassedCount'] == 18
    data['measuredAt'] = time.strftime('%Y-%m-%dT%H:%M:%S%z')
    save_json(path, data)
    render_html(dest, data)
    print('FINAL TRIM I=%s TP=%s; LUFS=%d/18 TP=%d/18' %
          (measured['input_i'], measured['input_tp'], data['lufsPassedCount'], data['truePeakPassedCount']))


def write_report(dest, report_dir):
    data = json.loads((dest / 'manifest.json').read_text(encoding='utf-8'))
    assert data['lufsPassedCount'] == 18 and data['truePeakPassedCount'] == 18
    before = json.loads((dest / data['correctionHistory']['path'] / 'manifest-before.json').read_text(encoding='utf-8'))
    planned = {'hit-normal-1', 'embed-1', 'embed-3'}
    for c, old in zip(data['candidates'], before['candidates']):
        assert c['id'] == old['id']
        assert sha(dest / c['originalPath']) == old['originalSha256']
        if c['id'] not in planned:
            assert sha(dest / c['candidatePath']) == old['candidateSha256']
        c['transformation'] = c['transformation'].replace(
            '(verification ceiling -1.5)', '(initial conservative ceiling -1.5; final verification -0.1 dBTP)')
    data['frozenAt'] = time.strftime('%Y-%m-%dT%H:%M:%S%z')
    data['browserPlaybackVerification'] = dict(status='pending-root-native-browser-QA', performedByThisTool=False)
    data['preservationVerified'] = dict(originalsUnchanged=18, passingCandidatesUnchanged=15,
                                         originalUniqueSha256=18, trims=0, repetitions=0, pitchOrSpeedChanges=0)
    data['verificationEvidence'] = dict(finalRawMeasurementLogs='logs/*-final-verification.log',
                                         commands='logs/*-final-verification-command.json',
                                         negativeShaTest='logs/negative-sha-test.txt',
                                         initialNormalizationStderr='not preserved; initial parsed JSON measurements retained')
    save_json(dest / 'manifest.json', data)
    render_html(dest, data)
    report_dir.mkdir(parents=True, exist_ok=True)
    save_json(report_dir / 'CODEX50-SFX-CANDIDATES.json', data)
    lines = ['# CODEX50-8 효과음 후보', '',
             '후보 18개(6종 × 3개)를 만들었습니다. 최종 전체 실측은 -18±0.3 LUFS **18/18**, true peak ≤-0.1 dBTP **18/18**입니다. 게임 설치는 0개입니다. 사람의 실청취·음색·게임 적합도 판정은 하지 않았습니다.', '',
             '- 듣기 페이지: [D:/에셋창고/sfx-candidates-50/index.html](D:/에셋창고/sfx-candidates-50/index.html)',
             '- 출처·저자·라이선스·원본/후보 SHA·각 패스 측정: [전체 JSON](CODEX50-SFX-CANDIDATES.json)',
             '- 공식 출처 조회일: 2026-11-20. 최종 실측: ' + data['measuredAt'] + '.',
             '- 원본 18개 5,055,560 bytes, 후보 18개 7,306,678 bytes. 원본 SHA 18종이며 중복 원본은 없습니다.',
             '- WAV 원본 17개는 RIFF/WAVE + 실제 전체 디코드, 공식 MP3 원본 1개는 MPEG 헤더 + 실제 전체 디코드를 확인했습니다. MIME과 HTTP 헤더도 보존했습니다.',
             '- 출처·라이선스 등급 A(공식 원문), 오디오 수치는 B(이 기기의 FFmpeg 7.1 실측)입니다.', '',
             '| 분류 | 후보 · 원문 | 저자 | 원본/후보 초 | LUFS | dBTP |',
             '|---|---|---|---:|---:|---:|']
    for c in data['candidates']:
        lines.append('| %s | %s · [%s](%s) | %s | %.3f / %.3f | %.2f | %.2f |' %
                     (c['category'], c['id'], c['title'], c['sourcePage'], c['author'],
                      c['originalAudio']['durationSeconds'], c['candidateAudio']['durationSeconds'],
                      c['measuredLufs'], c['measuredTruePeakDbtp']))
    lines += ['', '## 권리와 보존', '',
              '모두 SoundBible 공식 게시물의 [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)입니다. 저자·제목·공식 원문·CC 링크·가공 사실을 후보 HTML과 JSON에 함께 표시했습니다. 공공누리 후보를 사용했다고 주장하지 않습니다. 상업 이용·복제·가공·배포는 표시 의무를 전제로 허용되며, 이 후보에 추가 제한을 붙이지 않습니다. 공식 페이지 18개와 robots 사본은 evidence/에 보존했습니다.', '',
              '준비된 출처 JSON만 재사용했습니다. SoundBible 다운로드는 순차·최소 2.1초 간격이며 Windows curl의 TLS 검증을 유지했습니다. OGA robots 금지 확인 뒤 OGA에 접근하거나 우회하지 않았습니다. 추가 설치·게임 오디오 교체·새 선택 UI·커밋·푸시는 하지 않았습니다.', '',
              '원본 18개와 추가 교정 대상 이외의 기존 통과 후보 15개는 최종 SHA로 불변을 확인했습니다. 임의 구간 자르기·반복·피치·속도 변경은 0입니다. 긴 소스·연속 소리도 원본 전체를 남겼으므로 실제 적용 때 채택 여부와 구간을 따로 정해야 합니다.', '',
              '짧은 소스의 -inf LUFS를 처리하기 위해 뒤 무음만 추가했습니다: hit-normal-2 +2.7329375초, burst-1 +2.7786667초, burst-3 +2.6832708초. 각각 최종 3.000초이며 소리를 반복하지 않았습니다.', '',
              '## 음량 교정 이력', '',
              '처음 두 패스 loudnorm과 파일당 최대 두 교정 후 LUFS 15/18이었습니다. 자체 설정한 -1.5 dBTP가 사용자 요구가 아님을 확인하고, 승인된 추가 계약으로 최종 기준을 -18±0.3 LUFS와 true peak ≤-0.1 dBTP로 정했습니다. 기존 실패를 지우지 않고 history/20261121-peak-contract/manifest-before.json과 교정 전 WAV 3개를 보존했습니다.', '',
              '- hit-normal-1: -19.46/-1.28 → +1.17 dB 고정 이득 → **-18.26/-0.11**.',
              '- embed-3: -18.86/-1.55 → +0.86 dB 고정 이득 → **-18.04/-0.69**.',
              '- embed-1: -21.26/-1.27 → 192kHz 업샘플·+3.26 dB·release 1ms/ceiling -0.4 dBFS 제한기·48kHz → -18.59/-0.35. 이어 승인된 계산 교정 1회(+0.59 dB, 같은 방식의 ceiling -0.2 dBFS)로 **-18.14/-0.19**. 마지막 교정은 무제한 예상 peak +0.24 dBTP에서 약 0.44 dB peak 제한이 필요한 계산에 근거했습니다.',
              '- 위 수치는 LUFS/dBTP입니다. 제한기는 파형과 순간 강약을 바꿉니다. 초기 제한기는 release 50ms였고 추가 계약은 1ms로 바꾸어 짧은 음의 에너지 감쇄를 줄였습니다. 실제 음색 적합도는 미청취입니다.', '',
              '초기 정규화의 stderr 원문은 별도 보존하지 못했으며 파싱한 firstPass/measurements/corrections와 디코드 로그를 보존했습니다. 추가 계약의 모든 필터·명령·stderr·측정 원문은 logs/와 history/의 JSON에 보존했습니다. 최종 전체 18개 측정 원문과 명령도 logs/*-final-verification*에 있습니다.', '',
              '## 검수와 재현', '',
              '완료 조건은 6분류별 3후보, 실제 원본 오디오 전체 디코드, 원본/후보 SHA 일치, 최종 실제 파일 -18±0.3 LUFS와 true peak ≤-0.1 dBTP, HTML audio 18개·분류 6개·출처 표시입니다. 원본이 없던 최초 검사에서 빨강을 확인했고, 남은 3개가 미달일 때 verify가 실제로 실패했습니다. 손상시킨 SHA를 별도 임시 manifest에 넣었을 때도 실패하는지 확인했습니다. 도구 Python compile과 최종 실제 데이터 검사를 통과했습니다.', '',
              '기존 Python 3.9와 기존 FFmpeg 7.1을 사용합니다. 새 빈 출력 폴더에서 재현할 때 순서는 build → --finish-existing → --complete-remaining → --verify이며, 이미 완료한 폴더에는 교정 계약을 중복 실행하지 않도록 막았습니다. 전체 빌드에는 --source evidence/source-prep.json을 전달합니다. 도구: tools/raid-sfx-candidates.py.', '',
              '```powershell',
              "py -3.9 tools/raid-sfx-candidates.py --verify --output 'D:/에셋창고/sfx-candidates-50' --ffmpeg 'C:/Users/my/AppData/Roaming/Python/Python39/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'",
              '```', '',
              'native 브라우저의 metadata·재생·currentTime 검수는 root가 별도로 수행할 예정이며 이 문서 작성 시 미검증입니다. 게임 적합도·일반/치명 강약 차이·선정은 사용자 청취가 필요합니다. runtime assets를 추가하거나 게임을 바꾸지 않았으므로 이 작업에서 전체 npm 테스트/빌드를 중복 실행하지 않았습니다.', '']
    (report_dir / 'CODEX50-SFX-CANDIDATES.md').write_text('\n'.join(lines), encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--ffmpeg', required=True)
    parser.add_argument('--verify', action='store_true')
    parser.add_argument('--finish-existing', action='store_true')
    parser.add_argument('--complete-remaining', action='store_true')
    parser.add_argument('--report-dir', type=Path)
    args = parser.parse_args()
    if args.report_dir:
        write_report(args.output, args.report_dir)
    elif args.complete_remaining:
        complete_remaining(args.output, args.ffmpeg)
    elif args.finish_existing:
        finish_existing(args.output, args.ffmpeg)
    elif args.verify:
        verify(args.output, args.ffmpeg)
    else:
        if not args.source:
            parser.error('--source required for build')
        build(args.source, args.output, args.ffmpeg)
