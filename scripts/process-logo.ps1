Add-Type -AssemblyName System.Drawing

function Test-NearWhite {
    param([System.Drawing.Color]$Color, [int]$Tolerance = 35)
    return ($Color.A -gt 0) -and ($Color.R -ge (255 - $Tolerance)) -and ($Color.G -ge (255 - $Tolerance)) -and ($Color.B -ge (255 - $Tolerance))
}

function Test-NearDarkPurple {
    param([System.Drawing.Color]$Color)
    return ($Color.A -gt 0) -and ($Color.R -le 70) -and ($Color.G -le 45) -and ($Color.B -le 90) -and ($Color.R + $Color.G + $Color.B -le 180)
}

function Test-NearGrayText {
    param([System.Drawing.Color]$Color)
    return ($Color.A -gt 0) -and ($Color.R -gt 70) -and ($Color.R -lt 200) -and ([Math]::Abs($Color.R - $Color.G) -lt 25) -and ([Math]::Abs($Color.G - $Color.B) -lt 25)
}

function Remove-EdgeWhiteBackground {
    param([System.Drawing.Bitmap]$Bitmap, [int]$Tolerance = 35)

    $width = $Bitmap.Width
    $height = $Bitmap.Height
    $visited = New-Object 'bool[,]' $width, $height
    $queue = New-Object System.Collections.Generic.Queue[object]

    for ($x = 0; $x -lt $width; $x++) {
        $queue.Enqueue(@($x, 0))
        $queue.Enqueue(@($x, ($height - 1)))
    }

    for ($y = 0; $y -lt $height; $y++) {
        $queue.Enqueue(@(0, $y))
        $queue.Enqueue(@(($width - 1), $y))
    }

    while ($queue.Count -gt 0) {
        $point = $queue.Dequeue()
        $x = [int]$point[0]
        $y = [int]$point[1]

        if ($x -lt 0 -or $y -lt 0 -or $x -ge $width -or $y -ge $height) { continue }
        if ($visited[$x, $y]) { continue }

        $visited[$x, $y] = $true
        $pixel = $Bitmap.GetPixel($x, $y)

        if (-not (Test-NearWhite -Color $pixel -Tolerance $Tolerance)) { continue }

        $Bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
        $queue.Enqueue(@(($x + 1), $y))
        $queue.Enqueue(@(($x - 1), $y))
        $queue.Enqueue(@($x, ($y + 1)))
        $queue.Enqueue(@($x, ($y - 1)))
    }
}

function Convert-DarkTextToLight {
    param([System.Drawing.Bitmap]$Bitmap)

    $width = $Bitmap.Width
    $height = $Bitmap.Height

    for ($x = 0; $x -lt $width; $x++) {
        for ($y = 0; $y -lt $height; $y++) {
            $pixel = $Bitmap.GetPixel($x, $y)
            if ($pixel.A -eq 0) { continue }

            if (Test-NearDarkPurple -Color $pixel) {
                $Bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 255, 255, 255))
                continue
            }

            if (Test-NearGrayText -Color $pixel) {
                $Bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 210, 210, 220))
            }
        }
    }
}

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$inputPath = Join-Path $root 'public\logo-source.png'
$sourcePath = Join-Path $root 'public\logo.png'

if (-not (Test-Path $inputPath)) {
    Copy-Item -Path $sourcePath -Destination $inputPath -Force
}

$original = [System.Drawing.Bitmap]::FromFile($inputPath)

try {
    $standard = New-Object System.Drawing.Bitmap $original.Width, $original.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($standard)
    $graphics.DrawImage($original, 0, 0, $original.Width, $original.Height)
    $graphics.Dispose()

    Remove-EdgeWhiteBackground -Bitmap $standard

    $sidebar = New-Object System.Drawing.Bitmap $original.Width, $original.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $sidebarGraphics = [System.Drawing.Graphics]::FromImage($sidebar)
    $sidebarGraphics.DrawImage($original, 0, 0, $original.Width, $original.Height)
    $sidebarGraphics.Dispose()

    Remove-EdgeWhiteBackground -Bitmap $sidebar
    Convert-DarkTextToLight -Bitmap $sidebar

    $standardPath = Join-Path $root 'public\logo.png'
    $sidebarPath = Join-Path $root 'public\logo-sidebar.png'
    $standardTemp = Join-Path $root 'public\logo.tmp.png'
    $sidebarTemp = Join-Path $root 'public\logo-sidebar.tmp.png'

    $standard.Save($standardTemp, [System.Drawing.Imaging.ImageFormat]::Png)
    $sidebar.Save($sidebarTemp, [System.Drawing.Imaging.ImageFormat]::Png)

    Move-Item -Path $standardTemp -Destination $standardPath -Force
    Move-Item -Path $sidebarTemp -Destination $sidebarPath -Force

    Write-Output "Created $standardPath and $sidebarPath"
}
finally {
    $original.Dispose()
    if ($standard) { $standard.Dispose() }
    if ($sidebar) { $sidebar.Dispose() }
}
