# Bake large portrait copies for the hire cut-in scene (app.ts hireSceneHtml).
#   powershell -File tools/bust-hd.ps1
# Same sources as tools/realm-plate.ps1 busts, but 900px JPEG into public/realm/bust-hd/.
# The 320px cards in public/realm/bust/ are too blurry when one part is zoomed to fill the screen.
# Only (re)writes files whose source is newer, so it is cheap to run again.
param([string]$Src = 'assets_src/realm', [string]$Out = 'public/realm/bust-hd', [int]$Max = 900, [int]$Quality = 80)

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$jpeg = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$null = New-Item -ItemType Directory -Force $Out
$n = 0
foreach ($pair in @(@('generals/bust', 'g'), @('heroines/bust', 'w'), @('heroines/legend', 'l'))) {
  foreach ($f in Get-ChildItem "$Src/$($pair[0])" -File -Filter '*.png') {
    $to = Join-Path $Out "$($pair[1])-$($f.BaseName).jpg"
    if ((Test-Path $to) -and ((Get-Item $to).LastWriteTime -ge $f.LastWriteTime)) { continue }
    $img = [Drawing.Image]::FromFile($f.FullName)
    $s = [Math]::Min(1.0, $Max / [Math]::Max($img.Width, $img.Height))
    $w = [int][Math]::Round($img.Width * $s); $h = [int][Math]::Round($img.Height * $s)
    $bmp = New-Object Drawing.Bitmap $w, $h
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $w, $h)
    $p = New-Object Drawing.Imaging.EncoderParameters 1
    $p.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), ([long]$Quality)
    $bmp.Save($to, $jpeg, $p)
    $g.Dispose(); $bmp.Dispose(); $img.Dispose(); $n++
  }
}
Write-Output "bust-hd: $n written"
