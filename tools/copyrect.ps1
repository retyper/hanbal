param($Dst, $DstCell, $Src, [double]$SX, [double]$SY, [double]$SW, [double]$SH, $Out, [int]$Cols = 4, [int]$Rows = 2)
# 원본의 비율 네모(0~1)를 대상 칸에 비율 그대로 · 아래 맞춤으로 넣는다
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Drawing
$d = [System.Drawing.Bitmap]::FromFile($Dst); $s = [System.Drawing.Bitmap]::FromFile($Src)
$o = New-Object System.Drawing.Bitmap $d.Width, $d.Height
$g = [System.Drawing.Graphics]::FromImage($o); $g.DrawImage($d, 0, 0, $d.Width, $d.Height)
$dw = $d.Width / $Cols; $dh = $d.Height / $Rows; $di = [int]$DstCell - 1
$cx = ($di % $Cols) * $dw; $cy = [math]::Floor($di / $Cols) * $dh
$sr = New-Object System.Drawing.Rectangle ([int]($SX*$s.Width)), ([int]($SY*$s.Height)), ([int]($SW*$s.Width)), ([int]($SH*$s.Height))
$k = [math]::Min($dw / $sr.Width, $dh / $sr.Height)
$w = [int]($sr.Width * $k); $h = [int]($sr.Height * $k)
$g.SetClip((New-Object System.Drawing.Rectangle ([int]$cx), ([int]$cy), ([int]$dw), ([int]$dh))); $g.Clear([System.Drawing.Color]::Transparent)
$g.DrawImage($s, (New-Object System.Drawing.Rectangle ([int]($cx + ($dw - $w)/2)), ([int]($cy + $dh - $h - 4)), $w, $h), $sr, 'Pixel')
$d.Dispose(); $s.Dispose(); $o.Save($Out); 'ok'
