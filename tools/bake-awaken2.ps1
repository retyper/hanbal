# 진각성(2차) 초상 굽기 — 챗지피티에서 받은 1254px PNG 를 진각성 칸 꼴로 (bake-awaken.ps1 와 같은 결).
#   원본:  assets_src/realm/awaken2/<초상 id>.png
#   결과:  public/realm/awaken2-hd/<초상 id>.jpg (900px) · public/realm/awaken2/<초상 id>.jpg (320px)
#   powershell -NoProfile -File tools/bake-awaken2.ps1 w-30-guya-soebi w-33-gammun-gamsil
#   게임에서 진각성하게 하려면 그 장수 id 를 src/realm/data/awaken2.ts 의 TRUE_WAKE 에 더한다
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 88L
foreach ($id in $args) {
  $src = Join-Path $root "assets_src/realm/awaken2/$id.png"
  if (-not (Test-Path $src)) { Write-Output "없다: $src"; continue }
  $img = [System.Drawing.Image]::FromFile($src)
  foreach ($p in @(@(900, (Join-Path $root "public/realm/awaken2-hd/$id.jpg")), @(320, (Join-Path $root "public/realm/awaken2/$id.jpg")))) {
    $b = New-Object System.Drawing.Bitmap $p[0], $p[0]
    $g = [System.Drawing.Graphics]::FromImage($b)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $p[0], $p[0])
    $b.Save($p[1], $codec, $ep)
    $g.Dispose(); $b.Dispose()
    Write-Output ("{0} {1}KB" -f $p[1], [math]::Round((Get-Item $p[1]).Length / 1KB))
  }
  $img.Dispose()
}
