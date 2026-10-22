# 칠십팔국 시험판 그림 담기 — assets_src/realm (원본, gitignore) → public/realm (배포되는 작은 판)
#
#   powershell -File tools/realm-plate.ps1
#
# 원본은 1024~1376px PNG 라 그대로 싣기엔 크다. 여기서 크기를 맞추고, 불투명한 것(초상·지도·삽화)은 JPEG,
# 알파가 필요한 것(기호·깃발·병종)은 PNG 로 굽는다. 무엇을 어디에 쓰는지는 src/realm/data/art.ts.
# 이 기기엔 WebP 변환기가 없어 System.Drawing(JPEG·PNG)을 쓴다. 다시 돌려도 같은 결과 — 원본만 바뀌면 다시 굽는다.
# ★ 이 파일은 BOM 있는 UTF-8 이어야 한다 (PowerShell 5.1 은 BOM 없는 한글을 깨뜨린다).
param([string]$Src = 'assets_src/realm', [string]$Out = 'public/realm')

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$jpeg = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

function Fit([string]$from, [string]$to, [int]$max, [int]$quality = 0) {
  $img = [Drawing.Image]::FromFile((Resolve-Path $from))
  $s = [Math]::Min(1.0, $max / [Math]::Max($img.Width, $img.Height))
  $w = [int][Math]::Round($img.Width * $s)
  $h = [int][Math]::Round($img.Height * $s)
  $bmp = New-Object Drawing.Bitmap $w, $h, ([Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
  # 가장자리 테두리 번짐 막기
  $attr = New-Object Drawing.Imaging.ImageAttributes
  $attr.SetWrapMode([Drawing.Drawing2D.WrapMode]::TileFlipXY)
  $g.DrawImage($img, (New-Object Drawing.Rectangle 0, 0, $w, $h), 0, 0, $img.Width, $img.Height, [Drawing.GraphicsUnit]::Pixel, $attr)
  $null = New-Item -ItemType Directory -Force (Split-Path $to)
  if ($quality -gt 0) {
    $p = New-Object Drawing.Imaging.EncoderParameters 1
    $p.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), ([long]$quality)
    $bmp.Save($to, $jpeg, $p)
  } else {
    $bmp.Save($to, [Drawing.Imaging.ImageFormat]::Png)
  }
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
}

$n = 0
# 명치판 — 남자 장수 g- · 여인 w- · 전설 l-
foreach ($pair in @(@('generals/bust', 'g'), @('heroines/bust', 'w'), @('heroines/legend', 'l'))) {
  foreach ($f in Get-ChildItem "$Src/$($pair[0])" -File -Filter '*.png') {
    Fit $f.FullName "$Out/bust/$($pair[1])-$($f.BaseName).jpg" 320 86; $n++
  }
}
# 지도 — 같은 땅의 네 철
foreach ($pair in @(@('map-base-source', 'spring'), @('map-monsoon', 'summer'), @('map-autumn', 'autumn'), @('map-winter', 'winter'))) {
  Fit "$Src/$($pair[0]).png" "$Out/map/$($pair[1]).jpg" 1264 82; $n++
}
# 기호·깃발·병종·계절 — 알파
foreach ($prefix in @('settle', 'route', 'emblem', 'unit', 'status', 'good', 'treasure')) {
  foreach ($f in Get-ChildItem "$Src/cut" -File -Filter "$prefix-*.png") {
    if ($f.BaseName -in @('good-rice', 'good-salt', 'emblem-crow')) { continue }  # 2026-10-23: 이 셋은 다른 길(key-png·햇살 걷기)로 구운 public 이 원본보다 새것 — 덮지 않는다
    Fit $f.FullName "$Out/icon/$($f.BaseName).png" 96; $n++
  }
}
# 사건 삽화
foreach ($f in Get-ChildItem "$Src/cut" -File -Filter 'event-*.png') {
  Fit $f.FullName "$Out/event/$($f.BaseName).jpg" 1152 86; $n++   # 2026-10-23: 640 → 1152 (퀄리티가 크기보다 먼저)
}
# 첫 화면 그림 (front.ts)
foreach ($f in Get-ChildItem "$Src/cut" -File -Filter 'title-*.png') {
  Fit $f.FullName "$Out/title/$($f.BaseName).jpg" 1024 84; $n++
}
# 계절 넘김 띠 — 가로로 긴 그림 (seasonFx)
foreach ($f in Get-ChildItem "$Src/cut" -File -Filter 'season-*.png') {
  Fit $f.FullName "$Out/season/$($f.BaseName).jpg" 1024 80; $n++
}
$kb = [Math]::Round(((Get-ChildItem $Out -Recurse -File | Measure-Object Length -Sum).Sum) / 1KB)
"담았다: $n 장 → $Out ($kb KB)"
