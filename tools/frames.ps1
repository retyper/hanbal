param($In, $Out, [int]$NF, [int]$From, [int]$Count)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($In); $cw = $img.Width / $NF
$bmp = New-Object System.Drawing.Bitmap ([int]($cw * $Count)), $img.Height
$g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::FromArgb(225,225,225))
$g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, ([int]($cw*$Count)), $img.Height), (New-Object System.Drawing.Rectangle ([int]($cw*$From)), 0, ([int]($cw*$Count)), $img.Height), 'Pixel')
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::Red), 1
for ($i = 1; $i -lt $Count; $i++) { $g.DrawLine($pen, [int]($cw*$i), 0, [int]($cw*$i), $img.Height) }
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png); $img.Dispose()
