param($Dst, $DstCell, $Src, $SrcCell, $Out, [int]$Cols = 4, [int]$Rows = 2)
Add-Type -AssemblyName System.Drawing
$d = [System.Drawing.Bitmap]::FromFile($Dst); $s = [System.Drawing.Bitmap]::FromFile($Src)
$o = New-Object System.Drawing.Bitmap $d.Width, $d.Height
$g = [System.Drawing.Graphics]::FromImage($o); $g.DrawImage($d, 0, 0, $d.Width, $d.Height)
$dw = $d.Width / $Cols; $dh = $d.Height / $Rows; $sw = $s.Width / $Cols; $sh = $s.Height / $Rows
$di = [int]$DstCell - 1; $si = [int]$SrcCell - 1
$dr = New-Object System.Drawing.Rectangle ([int](($di % $Cols) * $dw)), ([int]([math]::Floor($di / $Cols) * $dh)), ([int]$dw), ([int]$dh)
$sr = New-Object System.Drawing.Rectangle ([int](($si % $Cols) * $sw)), ([int]([math]::Floor($si / $Cols) * $sh)), ([int]$sw), ([int]$sh)
$g.SetClip($dr); $g.Clear([System.Drawing.Color]::Transparent); $g.DrawImage($s, $dr, $sr, 'Pixel')
$d.Dispose(); $s.Dispose(); $o.Save($Out); 'ok'
