param(
    [string]$ToolPath = (Join-Path $PSScriptRoot "image-intake.ps1")
)

$ErrorActionPreference = "Stop"
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("wandermind-image-intake-" + [guid]::NewGuid().ToString("N"))
$imageRoot = Join-Path $testRoot "images"
$reviewCsv = Join-Path $testRoot "review.csv"
$manifestJson = Join-Path $testRoot "manifest.json"

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw "Assertion failed: $Message"
    }
}

try {
    New-Item -ItemType Directory -Path $imageRoot -Force | Out-Null
    Add-Type -AssemblyName System.Drawing
    $originalPath = Join-Path $imageRoot "ubud yogabarn1.jpg"
    $bitmap = [System.Drawing.Bitmap]::new(32, 20)
    try {
        $bitmap.Save($originalPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    }
    finally {
        $bitmap.Dispose()
    }

    $originalHash = (Get-FileHash -LiteralPath $originalPath -Algorithm SHA256).Hash
    & $ToolPath -InputDirectory $imageRoot -OutputCsv $reviewCsv -PublishManifest $manifestJson | Out-Null

    $firstRows = @(Import-Csv -LiteralPath $reviewCsv)
    $firstManifest = Get-Content -LiteralPath $manifestJson -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-True ($firstRows.Count -eq 1) "first scan should contain one image"
    Assert-True ($firstRows[0].SuggestedCategory -eq "experiences") "Yoga Barn should use the Experiences theme"
    Assert-True ($firstRows[0].SuggestedSubCategory -eq "wellness") "Yoga Barn should use the Wellness sub-category"
    Assert-True ($firstRows[0].SuggestedRouteIds -eq "R2") "Yoga Barn should map to R2"
    Assert-True ($firstRows[0].SuggestedPoiIds -eq "yoga_barn") "Yoga Barn should map to its POI"
    Assert-True ($firstRows[0].EligibleForPublish -eq "False") "unreviewed image must not be eligible"
    Assert-True (@($firstManifest.images).Count -eq 0) "unreviewed image must not enter the manifest"
    Assert-True ((Get-FileHash -LiteralPath $originalPath -Algorithm SHA256).Hash -eq $originalHash) "scan must not alter the source image"

    $firstRows[0].RightsStatus = "licensed"
    $firstRows[0].SourceUrl = "https://example.com/source"
    $firstRows[0].LicenseOrOwner = "Example license owner"
    $firstRows[0].Publishable = "True"
    $firstRows[0].HumanConfirmed = "True"
    $firstRows[0].IntendedUse = "route-card"
    $firstRows[0].AltTextZh = "乌布瑜伽体验"
    $firstRows | Export-Csv -LiteralPath $reviewCsv -NoTypeInformation -Encoding UTF8

    $renamedPath = Join-Path $imageRoot "yogabarn-renamed.jpg"
    Move-Item -LiteralPath $originalPath -Destination $renamedPath
    & $ToolPath -InputDirectory $imageRoot -OutputCsv $reviewCsv -PublishManifest $manifestJson | Out-Null

    $renamedRows = @(Import-Csv -LiteralPath $reviewCsv)
    $renamedManifest = Get-Content -LiteralPath $manifestJson -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-True ($renamedRows[0].HumanConfirmed -eq "True") "unique hash should preserve human confirmation after rename"
    Assert-True ($renamedRows[0].IntendedUse -eq "route-card") "unique hash should preserve review fields after rename"
    Assert-True ($renamedRows[0].EligibleForPublish -eq "False") "missing English alt text must block publication"
    Assert-True (@($renamedManifest.images).Count -eq 0) "incomplete content metadata must stay out of the manifest"

    $renamedRows[0].AltTextEn = "Ubud yoga experience"
    $renamedRows[0].IntendedUse = ""
    $renamedRows | Export-Csv -LiteralPath $reviewCsv -NoTypeInformation -Encoding UTF8
    & $ToolPath -InputDirectory $imageRoot -OutputCsv $reviewCsv -PublishManifest $manifestJson | Out-Null
    $missingUseRows = @(Import-Csv -LiteralPath $reviewCsv)
    Assert-True ($missingUseRows[0].EligibleForPublish -eq "False") "missing intended use must block publication"

    $missingUseRows[0].IntendedUse = "route-card"
    $missingUseRows[0].AltTextZh = ""
    $missingUseRows | Export-Csv -LiteralPath $reviewCsv -NoTypeInformation -Encoding UTF8
    & $ToolPath -InputDirectory $imageRoot -OutputCsv $reviewCsv -PublishManifest $manifestJson | Out-Null
    $missingZhRows = @(Import-Csv -LiteralPath $reviewCsv)
    Assert-True ($missingZhRows[0].EligibleForPublish -eq "False") "missing Chinese alt text must block publication"

    $missingZhRows[0].AltTextZh = "乌布瑜伽体验"
    $missingZhRows | Export-Csv -LiteralPath $reviewCsv -NoTypeInformation -Encoding UTF8
    & $ToolPath -InputDirectory $imageRoot -OutputCsv $reviewCsv -PublishManifest $manifestJson | Out-Null
    $approvedRows = @(Import-Csv -LiteralPath $reviewCsv)
    $approvedManifest = Get-Content -LiteralPath $manifestJson -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-True ($approvedRows[0].EligibleForPublish -eq "True") "fully reviewed image should become eligible"
    Assert-True (@($approvedManifest.images).Count -eq 1) "eligible image should enter the manifest"
    Assert-True ($approvedManifest.images[0].sub_category -eq "wellness") "manifest should retain the visual sub-category"

    $approvedManifest.schema_version = 2
    $approvedManifest | Add-Member -NotePropertyName approval -NotePropertyValue ([pscustomobject]@{
        approval_source = "test-review"
        approval_date = "2026-08-20"
    }) -Force
    $approvedManifest.images[0] | Add-Member -NotePropertyName web_optimized_path -NotePropertyValue "assets/images/web/test.webp" -Force
    $approvedManifest.images[0] | Add-Member -NotePropertyName title -NotePropertyValue ([pscustomobject]@{
        zh = "乌布瑜伽空间"
        en = "Ubud yoga space"
        ja = "ウブドのヨガ空間"
        ko = "우붓 요가 공간"
        id = "Ruang yoga Ubud"
    }) -Force
    $approvedManifest.images[0] | Add-Member -NotePropertyName description -NotePropertyValue ([pscustomobject]@{
        zh = "已人工审核的说明。"
        en = "A reviewed description."
        ja = "確認済みの説明。"
        ko = "검토된 설명입니다."
        id = "Deskripsi yang telah ditinjau."
    }) -Force
    $approvedManifest.images[0].alt_text | Add-Member -NotePropertyName ja -NotePropertyValue "ヨガマットのある室内" -Force
    $approvedManifest.images[0].alt_text | Add-Member -NotePropertyName ko -NotePropertyValue "요가 매트가 놓인 실내" -Force
    $approvedManifest.images[0].alt_text | Add-Member -NotePropertyName id -NotePropertyValue "Ruang dalam dengan matras yoga" -Force
    $approvedManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestJson -Encoding UTF8

    & $ToolPath -InputDirectory $imageRoot -OutputCsv $reviewCsv -PublishManifest $manifestJson | Out-Null
    $preservedManifest = Get-Content -LiteralPath $manifestJson -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-True ($preservedManifest.schema_version -eq 2) "repeat scans should preserve the reviewed manifest schema"
    Assert-True ($preservedManifest.approval.approval_source -eq "test-review") "repeat scans should preserve approval metadata"
    Assert-True ($preservedManifest.images[0].web_optimized_path -eq "assets/images/web/test.webp") "repeat scans should preserve optimized asset paths"
    Assert-True ($preservedManifest.images[0].title.ja -eq "ウブドのヨガ空間") "repeat scans should preserve localized titles"
    Assert-True ($preservedManifest.images[0].description.id -eq "Deskripsi yang telah ditinjau.") "repeat scans should preserve localized descriptions"
    Assert-True ($preservedManifest.images[0].alt_text.ko -eq "요가 매트가 놓인 실내") "repeat scans should preserve extended alt text"

    $duplicatePath = Join-Path $imageRoot "copy.jpg"
    Copy-Item -LiteralPath $renamedPath -Destination $duplicatePath
    & $ToolPath -InputDirectory $imageRoot -OutputCsv $reviewCsv -PublishManifest $manifestJson | Out-Null

    $duplicateRows = @(Import-Csv -LiteralPath $reviewCsv)
    $duplicateManifest = Get-Content -LiteralPath $manifestJson -Raw -Encoding UTF8 | ConvertFrom-Json
    $copyRow = $duplicateRows | Where-Object Filename -eq "copy.jpg"
    Assert-True ($duplicateRows.Count -eq 2) "duplicate scan should contain both files"
    Assert-True ($copyRow.HumanConfirmed -eq "False") "a new duplicate must not inherit approval by hash"
    Assert-True (@($duplicateManifest.images).Count -eq 1) "a duplicate must not create a second publish entry"
    Assert-True ((Get-FileHash -LiteralPath $renamedPath -Algorithm SHA256).Hash -eq $originalHash) "repeat scans must not alter source bytes"

    $replacementBitmap = [System.Drawing.Bitmap]::new(20, 20)
    try {
        $replacementBitmap.Save($renamedPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    }
    finally {
        $replacementBitmap.Dispose()
    }
    & $ToolPath -InputDirectory $imageRoot -OutputCsv $reviewCsv -PublishManifest $manifestJson | Out-Null

    $replacedRows = @(Import-Csv -LiteralPath $reviewCsv)
    $replacedManifest = Get-Content -LiteralPath $manifestJson -Raw -Encoding UTF8 | ConvertFrom-Json
    $replacedRow = $replacedRows | Where-Object Filename -eq "yogabarn-renamed.jpg"
    Assert-True ($replacedRow.HumanConfirmed -eq "False") "same-path content replacement must reset approval"
    Assert-True ($replacedRow.ReviewResetReason -eq "sha256_changed") "same-path replacement should explain the reset"
    Assert-True ($replacedRow.EligibleForPublish -eq "False") "same-path replacement must not remain eligible"
    Assert-True (@($replacedManifest.images).Count -eq 0) "same-path replacement must leave the manifest"

    $nonBaliPath = Join-Path $imageRoot "phuket-uluwatu-temple.jpg"
    $nonBaliBitmap = [System.Drawing.Bitmap]::new(16, 16)
    try {
        $nonBaliBitmap.Save($nonBaliPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    }
    finally {
        $nonBaliBitmap.Dispose()
    }
    & $ToolPath -InputDirectory $imageRoot -OutputCsv $reviewCsv -PublishManifest $manifestJson | Out-Null

    $locationRows = @(Import-Csv -LiteralPath $reviewCsv)
    $nonBaliRow = $locationRows | Where-Object Filename -eq "phuket-uluwatu-temple.jpg"
    Assert-True ($nonBaliRow.SuggestedCategory -eq "places") "non-Bali temple may still be classified by content"
    Assert-True ($nonBaliRow.SuggestedSubCategory -eq "iconic-attractions") "temple should use the iconic-attractions sub-category"
    Assert-True ($nonBaliRow.SuggestedLocationStatus -eq "non_bali_named") "explicit non-Bali filename should be flagged"
    Assert-True ([string]::IsNullOrWhiteSpace($nonBaliRow.SuggestedRegionIds)) "explicit non-Bali image must not map to a Bali region"
    Assert-True ([string]::IsNullOrWhiteSpace($nonBaliRow.SuggestedRouteIds)) "explicit non-Bali image must not map to a Bali route"
    Assert-True ([string]::IsNullOrWhiteSpace($nonBaliRow.SuggestedPoiIds)) "explicit non-Bali image must not map to a Bali POI"

    $nonBaliRow.RightsStatus = "licensed"
    $nonBaliRow.SourceUrl = "https://example.com/source"
    $nonBaliRow.LicenseOrOwner = "Example license owner"
    $nonBaliRow.Publishable = "True"
    $nonBaliRow.HumanConfirmed = "True"
    $nonBaliRow.IntendedUse = "route-card"
    $nonBaliRow.AltTextZh = "非巴厘岛寺庙"
    $nonBaliRow.AltTextEn = "Non-Bali temple"
    $locationRows | Export-Csv -LiteralPath $reviewCsv -NoTypeInformation -Encoding UTF8
    & $ToolPath -InputDirectory $imageRoot -OutputCsv $reviewCsv -PublishManifest $manifestJson | Out-Null
    $conflictRows = @(Import-Csv -LiteralPath $reviewCsv)
    $conflictManifest = Get-Content -LiteralPath $manifestJson -Raw -Encoding UTF8 | ConvertFrom-Json
    $conflictRow = $conflictRows | Where-Object Filename -eq "phuket-uluwatu-temple.jpg"
    Assert-True ($conflictRow.EligibleForPublish -eq "False") "location conflict must block publication even with approved rights"
    Assert-True (@($conflictManifest.images).Count -eq 0) "location conflict must not enter the manifest"

    Write-Output "PASS: image intake preserves reviews, blocks unapproved files, and handles duplicates safely."
}
finally {
    $resolvedTestRoot = [System.IO.Path]::GetFullPath($testRoot)
    $resolvedTempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    if ($resolvedTestRoot.StartsWith($resolvedTempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
        (Test-Path -LiteralPath $resolvedTestRoot)) {
        Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
    }
}
