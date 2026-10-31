# 각성 초상 굽기 — 챗지피티에서 받은 PNG(형이 g1 · w1 · l2 처럼 짧게 이름 붙임)를 장수 초상과 같은 꼴로 굽는다.
#   원본:  assets_src/realm/awaken/<짧은 이름>.png   (1254px · 131MB 라 배포하지 않는다)
#   결과:  public/realm/awaken-hd/<초상 id>.jpg (900px) · public/realm/awaken/<초상 id>.jpg (320px)
#   초상 id 는 public/realm/bust/ 의 파일 이름 (g1 → g-01-master-smith). 짧은 이름이 둘에 걸리거나 잘못 붙은 것은 $Fix 로 바로잡는다.
#   powershell -NoProfile -File tools/bake-awaken.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'assets_src/realm/awaken'
$bust = Join-Path $root 'public/realm/bust'
$outHd = Join-Path $root 'public/realm/awaken-hd'
$outSm = Join-Path $root 'public/realm/awaken'
New-Item -ItemType Directory -Force $outHd, $outSm | Out-Null
# 형 10-31: g67 은 진왕 진하(g-76) — 이름만 잘못 적힘
$Fix = @{ 'g67' = 'g-76-mokji-jinha' }
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 88L
function Save-Size($img, $size, $path) {
  $b = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($b)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $size, $size)
  $b.Save($path, $codec, $ep)
  $g.Dispose(); $b.Dispose()
}
foreach ($f in Get-ChildItem $src -Filter *.png) {
  $short = $f.BaseName
  $id = $Fix[$short]
  if (-not $id) {
    if ($short -match '^([gwl])(\d+)$') {
      $p = if ($Matches[1] -eq 'l') { "l-L$($Matches[2])-" } else { '{0}-{1:D2}-' -f $Matches[1], [int]$Matches[2] }
      $hit = @(Get-ChildItem $bust -Filter "$p*.jpg")
      if ($hit.Count -ne 1) { Write-Output "건너뜀 $short — 초상 $($hit.Count)개"; continue }
      $id = $hit[0].BaseName
    } else { Write-Output "건너뜀 $short — 이름 꼴이 다름"; continue }
  }
  $img = [System.Drawing.Image]::FromFile($f.FullName)
  Save-Size $img 900 (Join-Path $outHd "$id.jpg")
  Save-Size $img 320 (Join-Path $outSm "$id.jpg")
  $img.Dispose()
  Write-Output "$short -> $id"
}
