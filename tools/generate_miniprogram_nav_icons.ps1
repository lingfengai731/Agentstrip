param(
  [string]$OutputDirectory = (Join-Path (Split-Path $PSScriptRoot -Parent) 'miniprogram\assets\nav')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

function New-RoundedRectanglePath {
  param([float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius)
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-NavIcon {
  param([string]$Name, [string]$Color, [string]$FileName)
  $bitmap = [System.Drawing.Bitmap]::new(64, 64, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $ink = [System.Drawing.ColorTranslator]::FromHtml($Color)
  $pen = [System.Drawing.Pen]::new($ink, 4.2)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $brush = [System.Drawing.SolidBrush]::new($ink)

  switch ($Name) {
    'discover' {
      $graphics.DrawEllipse($pen, 10, 10, 44, 44)
      $north = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(38, 22),
        [System.Drawing.PointF]::new(32, 38),
        [System.Drawing.PointF]::new(26, 42)
      )
      $south = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(26, 42),
        [System.Drawing.PointF]::new(32, 26),
        [System.Drawing.PointF]::new(38, 22)
      )
      $graphics.DrawLines($pen, $north)
      $graphics.DrawLines($pen, $south)
      $graphics.FillEllipse($brush, 29, 29, 6, 6)
    }
    'ask' {
      $bubble = New-RoundedRectanglePath 9 11 46 34 8
      $graphics.DrawPath($pen, $bubble)
      $bubble.Dispose()
      $graphics.DrawLines($pen, [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(23, 44),
        [System.Drawing.PointF]::new(17, 52),
        [System.Drawing.PointF]::new(17, 43)
      ))
      $graphics.FillEllipse($brush, 20, 25, 6, 6)
      $graphics.DrawLine($pen, 26, 28, 38, 28)
      $graphics.FillEllipse($brush, 38, 25, 6, 6)
    }
    'prices' {
      $graphics.DrawLine($pen, 10, 52, 54, 52)
      $graphics.DrawRectangle($pen, 13, 31, 8, 21)
      $graphics.DrawRectangle($pen, 28, 15, 8, 37)
      $graphics.DrawRectangle($pen, 43, 24, 8, 28)
    }
    'trips' {
      $graphics.DrawLines($pen, [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(10, 17),
        [System.Drawing.PointF]::new(25, 11),
        [System.Drawing.PointF]::new(40, 17),
        [System.Drawing.PointF]::new(54, 11),
        [System.Drawing.PointF]::new(54, 47),
        [System.Drawing.PointF]::new(40, 53),
        [System.Drawing.PointF]::new(25, 47),
        [System.Drawing.PointF]::new(10, 53),
        [System.Drawing.PointF]::new(10, 17)
      ))
      $graphics.DrawLine($pen, 25, 12, 25, 47)
      $graphics.DrawLine($pen, 40, 18, 40, 52)
      $graphics.FillEllipse($brush, 30, 25, 8, 8)
    }
    'me' {
      $graphics.DrawEllipse($pen, 23, 10, 18, 18)
      $graphics.DrawArc($pen, 13, 31, 38, 25, 185, 170)
    }
    'hotel' {
      $graphics.DrawRectangle($pen, 13, 17, 38, 34)
      $graphics.DrawLine($pen, 20, 10, 44, 10)
      $graphics.DrawLine($pen, 20, 10, 20, 17)
      $graphics.DrawLine($pen, 44, 10, 44, 17)
      foreach ($x in @(22, 36)) { foreach ($y in @(26, 38)) { $graphics.FillRectangle($brush, $x, $y, 6, 6) } }
      $graphics.DrawLine($pen, 32, 45, 32, 51)
    }
    'flight' {
      $graphics.DrawLines($pen, [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(8, 34),
        [System.Drawing.PointF]::new(27, 30),
        [System.Drawing.PointF]::new(42, 12),
        [System.Drawing.PointF]::new(50, 14),
        [System.Drawing.PointF]::new(42, 31),
        [System.Drawing.PointF]::new(55, 38),
        [System.Drawing.PointF]::new(51, 44),
        [System.Drawing.PointF]::new(36, 39),
        [System.Drawing.PointF]::new(25, 53),
        [System.Drawing.PointF]::new(19, 51),
        [System.Drawing.PointF]::new(24, 36),
        [System.Drawing.PointF]::new(8, 34)
      ))
    }
  }

  $path = Join-Path $OutputDirectory $FileName
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $brush.Dispose()
  $pen.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

$navigation = @('discover', 'ask', 'prices', 'trips', 'me')
foreach ($name in $navigation) {
  New-NavIcon -Name $name -Color '#77716A' -FileName ($name + '.png')
  New-NavIcon -Name $name -Color '#0E7C6B' -FileName ($name + '-active.png')
}
New-NavIcon -Name 'hotel' -Color '#0E7C6B' -FileName 'hotel.png'
New-NavIcon -Name 'flight' -Color '#0E7C6B' -FileName 'flight.png'

Get-ChildItem -LiteralPath $OutputDirectory -Filter '*.png' | Select-Object Name, Length
