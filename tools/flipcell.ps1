param($In, $Cell, $Out, [int]$Cols = 4, [int]$Rows = 2)
# 격자 한 칸만 좌우로 뒤집는다 — 제미나이가 한 컷만 반대쪽을 보게 그렸을 때 (11-04 창병 걷기 5번)
Add-Type -AssemblyName System.Drawing
$s = [System.Drawing.Bitmap]::FromFile($In)
$o = New-Object System.Drawing.Bitmap $s.Width, $s.Height
$g = [System.Drawing.Graphics]::FromImage($o); $g.DrawImage($s, 0, 0, $s.Width, $s.Height)
$w = $s.Width / $Cols; $h = $s.Height / $Rows; $i = [int]$Cell - 1
$r = New-Object System.Drawing.Rectangle ([int](($i % $Cols) * $w)), ([int]([math]::Floor($i / $Cols) * $h)), ([int]$w), ([int]$h)
$c = $s.Clone($r, $s.PixelFormat); $c.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX)
$g.SetClip($r); $g.Clear([System.Drawing.Color]::Transparent); $g.DrawImage($c, $r.X, $r.Y, $r.Width, $r.Height)
$c.Dispose(); $s.Dispose(); $o.Save($Out); 'ok'
