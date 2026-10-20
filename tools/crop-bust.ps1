# 받은 그림에서 정사각 한 칸을 잘라 PNG 로 (System.Drawing — 이 기기엔 다른 변환기가 없다)
#
#   powershell -File tools/crop-bust.ps1 <받은그림> <out.png> <x> <y> <크기>
#   크기를 0 으로 주면 자르지 않고 PNG 로만 바꾼다 (제미나이는 .png 이름으로 JPEG 를 준다 — tools/key-png.mjs 는 PNG 만 읽는다)
#
# 제미나이 명치판은 오른쪽 아래에 반짝이(✦)를 찍는다 — 1024 정사각이면 (77,0) 870 으로 자르면 피한다 (docs/realm/ART.md 0-3).
param([string]$In, [string]$Out, [int]$X, [int]$Y, [int]$Size)
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile((Resolve-Path $In))
try {
  if ($Size -le 0) {
    $X = 0; $Y = 0
    $w = $src.Width; $h = $src.Height
  } else {
    $w = $Size; $h = $Size
  }
  $dst = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), (New-Object System.Drawing.Rectangle $X, $Y, $w, $h), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $dst.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
  $dst.Dispose()
  Write-Output "$Out ${w}x${h}"
} finally {
  $src.Dispose()
}
