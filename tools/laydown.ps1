# laydown.ps1 — 격자 한 칸(서 있는 사람)을 왼쪽으로 90도 눕혀 다른 칸에 바닥 맞춤으로 넣는다 (11-05 · 쓰러짐 장을 못 받았을 때)
#   쓰러짐 컷이 옷이 바뀌어 나올 때 맞음 컷을 눕혀 대신 쓴다 · 머리가 왼쪽, 발이 오른쪽
param($In, [int]$SrcCell, [int]$DstCell, $Out, [int]$Cols = 4, [int]$Rows = 2)
Add-Type -AssemblyName System.Drawing
$s = [System.Drawing.Bitmap]::FromFile($In)
$w = [int]($s.Width / $Cols); $h = [int]($s.Height / $Rows)
$si = $SrcCell - 1; $di = $DstCell - 1
$cell = New-Object System.Drawing.Bitmap $w, $h
$gc = [System.Drawing.Graphics]::FromImage($cell)
$gc.DrawImage($s, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), (New-Object System.Drawing.Rectangle (($si % $Cols) * $w), ([math]::Floor($si / $Cols) * $h), $w, $h), [System.Drawing.GraphicsUnit]::Pixel)
$gc.Dispose()
$cell.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone)
# 눕힌 그림의 불투명 경계
$minX = $cell.Width; $minY = $cell.Height; $maxX = 0; $maxY = 0
for ($y = 0; $y -lt $cell.Height; $y += 2) { for ($x = 0; $x -lt $cell.Width; $x += 2) { if ($cell.GetPixel($x, $y).A -gt 40) { if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }; if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y } } } }
$bw = $maxX - $minX + 1; $bh = $maxY - $minY + 1
$k = [math]::Min(1.0, ($w * 0.95) / $bw)
$o = New-Object System.Drawing.Bitmap $s.Width, $s.Height
$g = [System.Drawing.Graphics]::FromImage($o); $g.DrawImage($s, 0, 0, $s.Width, $s.Height)
$dx = ($di % $Cols) * $w; $dy = [math]::Floor($di / $Cols) * $h
$g.SetClip((New-Object System.Drawing.Rectangle $dx, $dy, $w, $h)); $g.Clear([System.Drawing.Color]::Transparent)
$tw = [int]($bw * $k); $th = [int]($bh * $k)
$g.DrawImage($cell, (New-Object System.Drawing.Rectangle ($dx + [int](($w - $tw) / 2)), ($dy + $h - $th - 4), $tw, $th), (New-Object System.Drawing.Rectangle $minX, $minY, $bw, $bh), [System.Drawing.GraphicsUnit]::Pixel)
$s.Dispose(); $o.Save($Out); 'ok'
