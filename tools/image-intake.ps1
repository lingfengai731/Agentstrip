param(
    [Parameter(Mandatory = $false)]
    [string]$InputDirectory = "E:\Agentstrip\wandermind-studio\frontend\assets\images",

    [Parameter(Mandatory = $false)]
    [string]$OutputCsv = "E:\Agentstrip\wandermind-studio\frontend\assets\data\image-intake-review.csv",

    [Parameter(Mandatory = $false)]
    [string]$PublishManifest = "E:\Agentstrip\wandermind-studio\frontend\assets\data\image-publish-manifest.json"
)

$ErrorActionPreference = "Stop"

$resolvedInput = (Resolve-Path -LiteralPath $InputDirectory).Path
$outputParent = Split-Path -Parent $OutputCsv
$manifestParent = Split-Path -Parent $PublishManifest
foreach ($directory in @($outputParent, $manifestParent) | Select-Object -Unique) {
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
}

Add-Type -AssemblyName System.Drawing

function ConvertTo-ReviewBoolean {
    param(
        [AllowNull()]
        [object]$Value,
        [bool]$Fallback = $false
    )

    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) {
        return $Fallback
    }

    $parsed = $false
    if ([bool]::TryParse([string]$Value, [ref]$parsed)) {
        return $parsed
    }

    return $Fallback
}

function Get-ReviewValue {
    param(
        [AllowNull()]
        [object]$Review,
        [string]$Name,
        [AllowNull()]
        [object]$Fallback = ""
    )

    if ($null -eq $Review) {
        return $Fallback
    }

    $property = $Review.PSObject.Properties[$Name]
    if ($null -eq $property -or $null -eq $property.Value) {
        return $Fallback
    }

    return $property.Value
}

function Get-ManifestValue {
    param(
        [AllowNull()]
        [object]$Entry,
        [string]$Name,
        [AllowNull()]
        [object]$Fallback = $null
    )

    if ($null -eq $Entry) {
        return $Fallback
    }

    $property = $Entry.PSObject.Properties[$Name]
    if ($null -eq $property -or $null -eq $property.Value) {
        return $Fallback
    }

    return $property.Value
}

function Get-ImageHints {
    param([string]$FileName)

    $name = $FileName.ToLowerInvariant()
    $category = "unclassified"
    $subCategory = ""
    $tags = @()
    $captureStyle = "unknown"
    $regions = @()
    $routes = @()
    $pois = @()
    $rightsStatus = "unknown"
    $publishable = $false
    $locationStatus = "unknown"

    if ($name -match "palau|phuket|thailand|koh chang|kauai|hawaii|greece|aegean|china") {
        $locationStatus = "non_bali_named"
        $tags += "location_conflict"
    }
    elseif ($name -match "bali|ubud|uluwatu|tanah lot|ulun danu|besakih|lempuyang|tirta empul|saraswati|taman ayun|galungan|nyepi|garuda|gwk|pyramids?.*chi|intuitive flow") {
        $locationStatus = "bali_named"
    }

    if ($name -match "dicky|gede|tourist") {
        $category = "people"
        $subCategory = "driver-trust-asset"
        $captureStyle = "phone_authentic"
        $tags += "driver"
    }
    if ($name -match "car|vehicle") {
        $category = "places"
        $subCategory = "road-trip"
        $captureStyle = "phone_authentic"
        $tags += "vehicle"
    }
    if ($name -match "temple|pura|tirta|lempuyang|besakih|tanah lot|ulun danu|saraswati|gwk|garuda") {
        $category = "places"
        $subCategory = "iconic-attractions"
        $tags += "culture", "temple"
    }
    if ($name -match "yoga|chi|healing|intuitive|sound") {
        $category = "experiences"
        $subCategory = "wellness"
        $tags += "wellness"
    }
    if ($name -match "beach|ocean|sunset|cliff|aerial|shore|coast") {
        if ($category -eq "unclassified") {
            $category = "landscapes"
            $subCategory = "ocean-beach"
        }
        $tags += "coast"
    }
    if ($name -match "beach\s*club|sunday\s*beach") {
        $category = "places"
        $subCategory = "hidden-gems"
        $tags += "beach-club"
    }
    if ($name -match "mountain|volcano|batur|agung|kintamani") {
        if ($category -eq "unclassified") {
            $category = "landscapes"
            $subCategory = "mountains-volcano"
        }
        $tags += "mountain"
    }
    if ($name -match "forest|waterfall|jungle") {
        if ($category -eq "unclassified") {
            $category = "landscapes"
            $subCategory = "forest-waterfall"
        }
        $tags += "nature"
    }
    if ($name -match "rice|terrace|countryside|sawah|jatiluwih|tegalalang") {
        if ($category -eq "unclassified") {
            $category = "landscapes"
            $subCategory = "rice-terrace-countryside"
        }
        $tags += "countryside"
    }
    if ($name -match "surf|snorkel|diving|hiking|trek|jeep") {
        $category = "experiences"
        $subCategory = "adventure"
        $tags += "adventure"
    }
    if ($name -match "food|coffee|cooking|restaurant|cafe") {
        $category = "experiences"
        $subCategory = "food-journey"
        $tags += "food"
    }
    if ($name -match "woodcarv|wood carv|batik|silver|jewelry|jewellery|weaving") {
        $category = "experiences"
        $subCategory = "creative-workshop"
        $tags += "craft"
    }
    if ($name -match "hotel|resort|villa") {
        $category = "places"
        $subCategory = "hotels-resorts"
        $tags += "stay"
    }
    if ($name -match "nyepi|galungan") {
        $category = "culture"
        $subCategory = "traditional-ceremony"
        $tags += "festival"
        $routes += "R4"
    }
    if ($name -match "yoga\s*.*barn|yogabarn") {
        $regions += "G4"
        $routes += "R2"
        $pois += "yoga_barn"
    }
    if ($name -match "pyramids?.*chi|chi.*pyramids?") {
        $regions += "G4"
        $routes += "R2"
        $pois += "pyramids_of_chi"
    }
    if ($name -match "heart\s*space") {
        $regions += "G4"
        $routes += "R2"
        $pois += "heart_space_bali"
    }
    if ($name -match "intuitive\s*flow") {
        $regions += "G4"
        $routes += "R2"
        $pois += "intuitive_flow"
    }
    if ($name -match "tirta\s*empul") {
        $regions += "G4"
        $routes += "R1", "R4"
        $pois += "tirta_empul"
    }
    if ($name -match "uluwatu" -and $name -match "temple|pura|luhur") {
        $regions += "G2"
        $routes += "R1", "R3", "R4"
        $pois += "uluwatu_temple"
    }
    if ($name -match "tanah\s*lot") {
        $regions += "G1"
        $routes += "R1", "R4", "R6"
        $pois += "tanah_lot"
    }
    if ($name -match "ulun\s*danu") {
        $regions += "G5"
        $routes += "R1", "R4"
        $pois += "ulun_danu_beratan"
    }
    if ($name -match "besakih") {
        $regions += "G6"
        $routes += "R4", "R5"
        $pois += "besakih_temple"
    }
    if ($name -match "garuda|gwk") {
        $regions += "G2"
        $routes += "R1", "R3", "R4"
        $pois += "gwk"
    }
    if ($name -match "lempuyang") {
        $regions += "G6"
        $routes += "R4", "R5"
    }
    if ($name -match "saraswati") {
        $regions += "G4"
        $routes += "R4"
    }
    if ($name -match "taman\s*ayun") {
        $routes += "R4"
    }
    if ($name -match "sunday\s*beach") {
        $regions += "G2"
        $routes += "R3", "R6"
    }
    if ($name -match "dicky|gede") {
        $rightsStatus = "user_provided_needs_confirmation"
    }
    if ($name -match "lempuyang temple") {
        $rightsStatus = "watermarked"
    }
    if ($locationStatus -eq "non_bali_named") {
        $regions = @()
        $routes = @()
        $pois = @()
    }

    [pscustomobject]@{
        Category = $category
        SubCategory = $subCategory
        Tags = (@($tags) | Select-Object -Unique) -join ";"
        CaptureStyle = $captureStyle
        LocationStatus = $locationStatus
        RegionIds = (@($regions) | Select-Object -Unique) -join ";"
        RouteIds = (@($routes) | Select-Object -Unique) -join ";"
        PoiIds = (@($pois) | Select-Object -Unique) -join ";"
        RightsStatus = $rightsStatus
        Publishable = $publishable
    }
}

$existingRows = @()
if (Test-Path -LiteralPath $OutputCsv) {
    $existingRows = @(Import-Csv -LiteralPath $OutputCsv)
}

$existingManifest = $null
$existingManifestByHash = @{}
if (Test-Path -LiteralPath $PublishManifest) {
    try {
        $existingManifest = Get-Content -LiteralPath $PublishManifest -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        throw "Existing publish manifest is invalid; refusing to overwrite reviewed metadata: $($_.Exception.Message)"
    }

    foreach ($entry in @($existingManifest.images)) {
        $entryHash = [string](Get-ManifestValue -Entry $entry -Name "sha256")
        if ([string]::IsNullOrWhiteSpace($entryHash)) {
            continue
        }
        if ($existingManifestByHash.ContainsKey($entryHash)) {
            throw "Existing publish manifest contains a duplicate SHA-256: $entryHash"
        }
        $existingManifestByHash[$entryHash] = $entry
    }
}

$existingByPath = @{}
foreach ($row in $existingRows) {
    if (-not [string]::IsNullOrWhiteSpace($row.RelativePath)) {
        $existingByPath[$row.RelativePath] = $row
    }
}

$existingByUniqueHash = @{}
foreach ($group in @($existingRows | Where-Object {
    -not [string]::IsNullOrWhiteSpace($_.Sha256)
} | Group-Object Sha256)) {
    if ($group.Count -eq 1) {
        $existingByUniqueHash[$group.Name] = $group.Group[0]
    }
}

$inventory = @(
    Get-ChildItem -LiteralPath $resolvedInput -File |
        Where-Object { $_.Extension.ToLowerInvariant() -in ".jpg", ".jpeg", ".png", ".webp" } |
        ForEach-Object {
            [pscustomobject]@{
                File = $_
                RelativePath = "assets/images/$($_.Name)"
                Sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            }
        }
)

$currentHashCounts = @{}
foreach ($group in @($inventory | Group-Object Sha256)) {
    $currentHashCounts[$group.Name] = $group.Count
}

$rows = foreach ($item in $inventory) {
    $file = $item.File
    $width = $null
    $height = $null
    $readError = ""

    try {
        $image = [System.Drawing.Image]::FromFile($file.FullName)
        try {
            $width = $image.Width
            $height = $image.Height
        }
        finally {
            $image.Dispose()
        }
    }
    catch {
        $readError = $_.Exception.Message
    }

    $review = $null
    $reviewResetReason = ""
    if ($existingByPath.ContainsKey($item.RelativePath)) {
        $pathReview = $existingByPath[$item.RelativePath]
        if ($pathReview.Sha256 -eq $item.Sha256) {
            $review = $pathReview
        }
        else {
            # Replacing bytes at the same path requires a fresh human review.
            $reviewResetReason = "sha256_changed"
        }
    }
    elseif ($currentHashCounts[$item.Sha256] -eq 1 -and $existingByUniqueHash.ContainsKey($item.Sha256)) {
        # A unique hash carries the review across a filename change.
        $review = $existingByUniqueHash[$item.Sha256]
    }

    $hints = Get-ImageHints -FileName $file.Name
    $rightsStatus = [string](Get-ReviewValue -Review $review -Name "RightsStatus" -Fallback $hints.RightsStatus)
    $publishable = ConvertTo-ReviewBoolean -Value (Get-ReviewValue -Review $review -Name "Publishable" -Fallback $hints.Publishable)
    $humanConfirmed = ConvertTo-ReviewBoolean -Value (Get-ReviewValue -Review $review -Name "HumanConfirmed" -Fallback $false)
    $sourceUrl = [string](Get-ReviewValue -Review $review -Name "SourceUrl")
    $licenseOrOwner = [string](Get-ReviewValue -Review $review -Name "LicenseOrOwner")
    $intendedUse = [string](Get-ReviewValue -Review $review -Name "IntendedUse")
    $altTextZh = [string](Get-ReviewValue -Review $review -Name "AltTextZh")
    $altTextEn = [string](Get-ReviewValue -Review $review -Name "AltTextEn")
    $approvedRights = $rightsStatus -in @(
        "owned",
        "user_provided_with_consent",
        "licensed",
        "public_domain",
        "cc0"
    )
    $externalRights = $rightsStatus -in @("licensed", "public_domain", "cc0")
    $hasRequiredProvenance = -not [string]::IsNullOrWhiteSpace($licenseOrOwner) -and (
        -not $externalRights -or -not [string]::IsNullOrWhiteSpace($sourceUrl)
    )
    $eligibleForPublish = (
        $humanConfirmed -and
        $publishable -and
        $approvedRights -and
        $hasRequiredProvenance -and
        $hints.LocationStatus -ne "non_bali_named" -and
        -not [string]::IsNullOrWhiteSpace($intendedUse) -and
        -not [string]::IsNullOrWhiteSpace($altTextZh) -and
        -not [string]::IsNullOrWhiteSpace($altTextEn) -and
        [string]::IsNullOrWhiteSpace($readError)
    )

    [pscustomobject][ordered]@{
        Filename = $file.Name
        RelativePath = $item.RelativePath
        Bytes = $file.Length
        Width = $width
        Height = $height
        Sha256 = $item.Sha256
        SuggestedCategory = $hints.Category
        SuggestedSubCategory = $hints.SubCategory
        SuggestedTags = $hints.Tags
        SuggestedCaptureStyle = $hints.CaptureStyle
        SuggestedLocationStatus = $hints.LocationStatus
        SuggestedRegionIds = $hints.RegionIds
        SuggestedRouteIds = $hints.RouteIds
        SuggestedPoiIds = $hints.PoiIds
        RightsStatus = $rightsStatus
        SourceUrl = $sourceUrl
        LicenseOrOwner = $licenseOrOwner
        Publishable = $publishable
        HumanConfirmed = $humanConfirmed
        IntendedUse = $intendedUse
        AltTextZh = $altTextZh
        AltTextEn = $altTextEn
        ReviewNotes = [string](Get-ReviewValue -Review $review -Name "ReviewNotes")
        ReviewResetReason = $reviewResetReason
        ReadError = $readError
        EligibleForPublish = $eligibleForPublish
    }
}

$rows = @($rows | Sort-Object RelativePath)
$rows | Export-Csv -LiteralPath $OutputCsv -NoTypeInformation -Encoding UTF8

$manifestImages = @(
    $rows |
        Where-Object { $_.EligibleForPublish } |
        ForEach-Object {
            $existingEntry = $existingManifestByHash[$_.Sha256]
            $localizedAlt = [ordered]@{
                zh = $_.AltTextZh
                en = $_.AltTextEn
            }
            $existingAlt = Get-ManifestValue -Entry $existingEntry -Name "alt_text"
            foreach ($language in @("ja", "ko", "id")) {
                $value = [string](Get-ManifestValue -Entry $existingAlt -Name $language)
                if (-not [string]::IsNullOrWhiteSpace($value)) {
                    $localizedAlt[$language] = $value
                }
            }

            $manifestItem = [ordered]@{
                relative_path = $_.RelativePath
            }
            foreach ($pathField in @("web_optimized_path", "thumbnail_path")) {
                $pathValue = [string](Get-ManifestValue -Entry $existingEntry -Name $pathField)
                if (-not [string]::IsNullOrWhiteSpace($pathValue)) {
                    $manifestItem[$pathField] = $pathValue
                }
            }
            $manifestItem["sha256"] = $_.Sha256
            $manifestItem["category"] = $_.SuggestedCategory
            $manifestItem["sub_category"] = $_.SuggestedSubCategory
            $manifestItem["tags"] = @($_.SuggestedTags -split ";" | Where-Object { $_ })
            $manifestItem["location_status"] = $_.SuggestedLocationStatus
            $manifestItem["region_ids"] = @($_.SuggestedRegionIds -split ";" | Where-Object { $_ })
            $manifestItem["route_ids"] = @($_.SuggestedRouteIds -split ";" | Where-Object { $_ })
            $manifestItem["poi_ids"] = @($_.SuggestedPoiIds -split ";" | Where-Object { $_ })
            $manifestItem["intended_use"] = $_.IntendedUse
            foreach ($copyField in @("title", "description")) {
                $copyValue = Get-ManifestValue -Entry $existingEntry -Name $copyField
                if ($null -ne $copyValue) {
                    $manifestItem[$copyField] = $copyValue
                }
            }
            $manifestItem["alt_text"] = $localizedAlt
            $manifestItem["rights"] = [ordered]@{
                status = $_.RightsStatus
                source_url = $_.SourceUrl
                license_or_owner = $_.LicenseOrOwner
            }
            $manifestItem
        }
)

$manifest = [ordered]@{
    schema_version = if ($null -ne $existingManifest) { Get-ManifestValue -Entry $existingManifest -Name "schema_version" -Fallback 1 } else { 1 }
    policy = if ($null -ne $existingManifest) { Get-ManifestValue -Entry $existingManifest -Name "policy" -Fallback "Only HumanConfirmed + Publishable images with approved rights and provenance are included." } else { "Only HumanConfirmed + Publishable images with approved rights and provenance are included." }
}
$existingApproval = Get-ManifestValue -Entry $existingManifest -Name "approval"
if ($null -ne $existingApproval) {
    $manifest["approval"] = $existingApproval
}
$manifest["images"] = $manifestImages
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $PublishManifest -Encoding UTF8

Write-Output "Image intake complete: $($rows.Count) files"
Write-Output "Review CSV: $OutputCsv"
Write-Output "Publish manifest: $PublishManifest ($($manifestImages.Count) eligible files)"
Write-Output "No source images were moved, renamed, overwritten, or deleted."
