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

function Get-PreferredManifestValue {
    param(
        [AllowNull()]
        [object]$Entry,
        [string]$Name,
        [AllowNull()]
        [object]$Fallback = $null
    )

    if ($null -eq $Entry) {
        if ($Fallback -is [System.Array]) { return ,$Fallback }
        return $Fallback
    }
    $property = $Entry.PSObject.Properties[$Name]
    if ($null -eq $property) {
        if ($Fallback -is [System.Array]) { return ,$Fallback }
        return $Fallback
    }
    if ($property.Value -is [System.Array]) { return ,$property.Value }
    return $property.Value
}

function Test-UsableLocalizedText {
    param([AllowNull()][object]$Value)

    $text = [string]$Value
    if ([string]::IsNullOrWhiteSpace($text)) {
        return $false
    }
    return $text.Trim() -notmatch "^\?+$"
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
    if ($name -match "(^|[^a-z])car([^a-z]|$)|vehicle") {
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
    if ($name -match "campuhan\s+ridge\s+walk") {
        $category = "landscapes"
        $subCategory = "nature-walk"
        $tags += "ridge", "walk", "nature"
        $locationStatus = "bali_named"
        $regions += "G4"
        $routes += "R1", "R2", "R4", "R6"
        $pois += "campuhan_ridge_walk"
    }
    if ($name -match "tegal+a?lang\s+rice\s+terraces?") {
        $category = "landscapes"
        $subCategory = "rice-terrace-countryside"
        $tags += "rice-terrace", "countryside", "photography"
        $locationStatus = "bali_named"
        $regions += "G4"
        $routes += "R1", "R2", "R4", "R6"
        $pois += "tegalalang_rice_terrace"
    }
    if ($name -match "ubud\s+(art\s+)?market") {
        $category = "culture"
        $subCategory = "market-craft"
        $tags += "market", "craft", "culture"
        $locationStatus = "bali_named"
        $regions += "G4"
        $routes += "R1", "R2", "R4", "R6"
        $pois += "ubud_art_market"
    }
    if ($name -match "melasti\s+beach") {
        $category = "landscapes"
        $subCategory = "ocean-beach"
        $tags += "beach", "coast", "cliff"
        $locationStatus = "bali_named"
        $regions += "G2"
        $routes += "R1", "R3", "R6"
        $pois += "melasti_beach"
    }
    if ($name -match "ubud\s+palace") {
        $category = "culture"
        $subCategory = "heritage-architecture"
        $tags += "palace", "architecture", "culture"
        $locationStatus = "bali_named"
        $regions += "G4"
        $routes += "R1", "R2", "R4"
        $pois += "ubud_palace"
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
        elseif ($currentHashCounts[$item.Sha256] -eq 1 -and $existingByUniqueHash.ContainsKey($item.Sha256)) {
            # Exact bytes that were already reviewed under another path keep
            # their approval; this is a rename/alias, not unknown replacement
            # content.
            $review = $existingByUniqueHash[$item.Sha256]
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
    $existingEntry = $existingManifestByHash[$item.Sha256]
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

    $webOptimizedPath = [string](Get-ReviewValue -Review $review -Name "WebOptimizedPath")
    if ([string]::IsNullOrWhiteSpace($webOptimizedPath)) {
        $webOptimizedPath = [string](Get-ManifestValue -Entry $existingEntry -Name "web_optimized_path")
    }
    $thumbnailPath = [string](Get-ReviewValue -Review $review -Name "ThumbnailPath")
    if ([string]::IsNullOrWhiteSpace($thumbnailPath)) {
        $thumbnailPath = [string](Get-ManifestValue -Entry $existingEntry -Name "thumbnail_path")
    }
    $hashStem = $item.Sha256.Substring(0, 16)
    if ([string]::IsNullOrWhiteSpace($webOptimizedPath) -and (Test-Path -LiteralPath (Join-Path $resolvedInput "web\$hashStem.webp"))) {
        $webOptimizedPath = "assets/images/web/$hashStem.webp"
    }
    if ([string]::IsNullOrWhiteSpace($thumbnailPath) -and (Test-Path -LiteralPath (Join-Path $resolvedInput "thumbs\$hashStem.webp"))) {
        $thumbnailPath = "assets/images/thumbs/$hashStem.webp"
    }

    $manifestCategory = [string](Get-ManifestValue -Entry $existingEntry -Name "category")
    $manifestSubCategory = [string](Get-ManifestValue -Entry $existingEntry -Name "sub_category")
    $manifestLocationStatus = [string](Get-ManifestValue -Entry $existingEntry -Name "location_status")
    $manifestTags = @((Get-ManifestValue -Entry $existingEntry -Name "tags") | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }) -join ";"
    $manifestRegionIds = @((Get-ManifestValue -Entry $existingEntry -Name "region_ids") | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }) -join ";"
    $manifestRouteIds = @((Get-ManifestValue -Entry $existingEntry -Name "route_ids") | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }) -join ";"
    $manifestPoiIds = @((Get-ManifestValue -Entry $existingEntry -Name "poi_ids") | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }) -join ";"
    $suggestedCategory = if ($manifestCategory) { $manifestCategory } else { [string](Get-ReviewValue -Review $review -Name "SuggestedCategory" -Fallback $hints.Category) }
    $suggestedSubCategory = if ($manifestSubCategory) { $manifestSubCategory } else { [string](Get-ReviewValue -Review $review -Name "SuggestedSubCategory" -Fallback $hints.SubCategory) }
    $suggestedTags = if ($manifestTags) { $manifestTags } else { [string](Get-ReviewValue -Review $review -Name "SuggestedTags" -Fallback $hints.Tags) }
    $suggestedCaptureStyle = [string](Get-ReviewValue -Review $review -Name "SuggestedCaptureStyle" -Fallback $hints.CaptureStyle)
    $suggestedLocationStatus = if ($manifestLocationStatus) { $manifestLocationStatus } else { [string](Get-ReviewValue -Review $review -Name "SuggestedLocationStatus" -Fallback $hints.LocationStatus) }
    $suggestedRegionIds = if ($manifestRegionIds) { $manifestRegionIds } else { [string](Get-ReviewValue -Review $review -Name "SuggestedRegionIds" -Fallback $hints.RegionIds) }
    $suggestedRouteIds = if ($manifestRouteIds) { $manifestRouteIds } else { [string](Get-ReviewValue -Review $review -Name "SuggestedRouteIds" -Fallback $hints.RouteIds) }
    $suggestedPoiIds = if ($manifestPoiIds) { $manifestPoiIds } else { [string](Get-ReviewValue -Review $review -Name "SuggestedPoiIds" -Fallback $hints.PoiIds) }

    [pscustomobject][ordered]@{
        Filename = $file.Name
        RelativePath = $item.RelativePath
        Bytes = $file.Length
        Width = $width
        Height = $height
        Sha256 = $item.Sha256
        SuggestedCategory = $suggestedCategory
        SuggestedSubCategory = $suggestedSubCategory
        SuggestedTags = $suggestedTags
        SuggestedCaptureStyle = $suggestedCaptureStyle
        SuggestedLocationStatus = $suggestedLocationStatus
        SuggestedRegionIds = $suggestedRegionIds
        SuggestedRouteIds = $suggestedRouteIds
        SuggestedPoiIds = $suggestedPoiIds
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
        WebOptimizedPath = $webOptimizedPath
        ThumbnailPath = $thumbnailPath
    }
}

$currentInventoryPaths = @{}
$currentInventoryHashes = @{}
foreach ($item in $inventory) {
    $currentInventoryPaths[$item.RelativePath] = $true
    $currentInventoryHashes[$item.Sha256] = $true
}
foreach ($existingRow in $existingRows) {
    $existingPath = [string](Get-ReviewValue -Review $existingRow -Name "RelativePath")
    $existingHash = [string](Get-ReviewValue -Review $existingRow -Name "Sha256")
    if (-not $currentInventoryPaths.ContainsKey($existingPath) -and -not $currentInventoryHashes.ContainsKey($existingHash)) {
        $rows += $existingRow
    }
}
$rows = @($rows | Sort-Object RelativePath)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
function ConvertTo-MinimalCsvField {
    param([AllowNull()]$Value)

    $text = if ($null -eq $Value) { "" } else { [string]$Value }
    if ($text -match '[,"\r\n]') {
        return '"' + $text.Replace('"', '""') + '"'
    }
    return $text
}

$csvColumns = @($rows[0].PSObject.Properties.Name)
$csvLines = @(
    ($csvColumns | ForEach-Object { ConvertTo-MinimalCsvField -Value $_ }) -join ','
    foreach ($row in $rows) {
        ($csvColumns | ForEach-Object { ConvertTo-MinimalCsvField -Value $row.$_ }) -join ','
    }
)
[System.IO.File]::WriteAllLines($OutputCsv, $csvLines, $utf8NoBom)

$manifestImages = @(
    $rows |
        Where-Object { ConvertTo-ReviewBoolean -Value $_.EligibleForPublish } |
        ForEach-Object {
            $existingEntry = $existingManifestByHash[$_.Sha256]
            if ($null -ne $existingEntry) {
                $preservedEntry = [ordered]@{}
                foreach ($property in $existingEntry.PSObject.Properties) {
                    $preservedEntry[$property.Name] = $property.Value
                }
                foreach ($pathMapping in @(
                    @{ Manifest = "web_optimized_path"; Review = "WebOptimizedPath" },
                    @{ Manifest = "thumbnail_path"; Review = "ThumbnailPath" }
                )) {
                    $existingPathValue = [string](Get-ManifestValue -Entry $existingEntry -Name $pathMapping.Manifest)
                    $reviewPathValue = [string](Get-ReviewValue -Review $_ -Name $pathMapping.Review)
                    if ([string]::IsNullOrWhiteSpace($existingPathValue) -and -not [string]::IsNullOrWhiteSpace($reviewPathValue)) {
                        $preservedEntry[$pathMapping.Manifest] = $reviewPathValue
                    }
                }
                $preservedEntry
                return
            }
            $existingAlt = Get-ManifestValue -Entry $existingEntry -Name "alt_text"
            $localizedAlt = [ordered]@{}
            foreach ($language in @("zh", "en", "ja", "ko", "id")) {
                $freshValue = if ($language -eq "zh") { $_.AltTextZh } elseif ($language -eq "en") { $_.AltTextEn } else { "" }
                $existingValue = [string](Get-ManifestValue -Entry $existingAlt -Name $language)
                if (Test-UsableLocalizedText -Value $freshValue) {
                    $localizedAlt[$language] = [string]$freshValue
                }
                elseif (-not [string]::IsNullOrWhiteSpace($existingValue)) {
                    $localizedAlt[$language] = $existingValue
                }
            }

            $existingRelativePath = [string](Get-ManifestValue -Entry $existingEntry -Name "relative_path")
            $manifestItem = [ordered]@{
                relative_path = if ([string]::IsNullOrWhiteSpace($existingRelativePath)) { $_.RelativePath } else { $existingRelativePath }
            }
            foreach ($pathMapping in @(
                @{ Manifest = "web_optimized_path"; Review = "WebOptimizedPath" },
                @{ Manifest = "thumbnail_path"; Review = "ThumbnailPath" }
            )) {
                $pathValue = [string](Get-ReviewValue -Review $_ -Name $pathMapping.Review)
                if (-not [string]::IsNullOrWhiteSpace($pathValue)) {
                    $manifestItem[$pathMapping.Manifest] = $pathValue
                }
            }
            $manifestItem["sha256"] = $_.Sha256
            $manifestItem["category"] = Get-PreferredManifestValue -Entry $existingEntry -Name "category" -Fallback $_.SuggestedCategory
            $manifestItem["sub_category"] = Get-PreferredManifestValue -Entry $existingEntry -Name "sub_category" -Fallback $_.SuggestedSubCategory
            $manifestItem["tags"] = Get-PreferredManifestValue -Entry $existingEntry -Name "tags" -Fallback @($_.SuggestedTags -split ";" | Where-Object { $_ })
            $manifestItem["location_status"] = Get-PreferredManifestValue -Entry $existingEntry -Name "location_status" -Fallback $_.SuggestedLocationStatus
            $manifestItem["region_ids"] = Get-PreferredManifestValue -Entry $existingEntry -Name "region_ids" -Fallback @($_.SuggestedRegionIds -split ";" | Where-Object { $_ })
            $manifestItem["route_ids"] = Get-PreferredManifestValue -Entry $existingEntry -Name "route_ids" -Fallback @($_.SuggestedRouteIds -split ";" | Where-Object { $_ })
            $manifestItem["poi_ids"] = Get-PreferredManifestValue -Entry $existingEntry -Name "poi_ids" -Fallback @($_.SuggestedPoiIds -split ";" | Where-Object { $_ })
            $manifestItem["intended_use"] = Get-PreferredManifestValue -Entry $existingEntry -Name "intended_use" -Fallback $_.IntendedUse
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

# Some reviewed assets keep only their published WebP in this checkout. A fresh
# source scan must not silently delete those approved manifest entries. An
# ineligible file with the same SHA-256 removes its own published identity; a
# different file placed at the same path does not silently retire the previous
# reviewed asset.
$currentInventoryByHash = @{}
foreach ($item in $inventory) {
    $currentInventoryByHash[$item.Sha256] = $true
}
$generatedByHash = @{}
foreach ($entry in $manifestImages) {
    $generatedByHash[[string]$entry.sha256] = $entry
}
$mergedManifestImages = @()
$mergedHashes = @{}
$preservedReviewedCount = 0
foreach ($entry in @($existingManifest.images)) {
    if ($null -eq $entry) {
        continue
    }
    $entryHash = [string](Get-ManifestValue -Entry $entry -Name "sha256")
    if ([string]::IsNullOrWhiteSpace($entryHash)) {
        continue
    }
    if ($generatedByHash.ContainsKey($entryHash)) {
        $mergedManifestImages += $generatedByHash[$entryHash]
        $mergedHashes[$entryHash] = $true
        continue
    }
    if ($currentInventoryByHash.ContainsKey($entryHash)) {
        continue
    }
    $mergedManifestImages += $entry
    $mergedHashes[$entryHash] = $true
    $preservedReviewedCount += 1
}
foreach ($entry in $manifestImages) {
    $entryHash = [string]$entry.sha256
    if (-not $mergedHashes.ContainsKey($entryHash)) {
        $mergedManifestImages += $entry
        $mergedHashes[$entryHash] = $true
    }
}
$manifestImages = @($mergedManifestImages)

$manifest = [ordered]@{
    schema_version = if ($null -ne $existingManifest) { Get-ManifestValue -Entry $existingManifest -Name "schema_version" -Fallback 1 } else { 1 }
    policy = if ($null -ne $existingManifest) { Get-ManifestValue -Entry $existingManifest -Name "policy" -Fallback "Only HumanConfirmed + Publishable images with approved rights and provenance are included." } else { "Only HumanConfirmed + Publishable images with approved rights and provenance are included." }
}
$existingApproval = Get-ManifestValue -Entry $existingManifest -Name "approval"
if ($null -ne $existingApproval) {
    $manifest["approval"] = $existingApproval
}
$manifest["images"] = $manifestImages
$manifestJson = $manifest | ConvertTo-Json -Depth 8
$manifestJson = $manifestJson -replace '\[\r?\n\s*\]', '[]'
$manifestJson = $manifestJson -replace "`r`n", "`n"
[System.IO.File]::WriteAllText($PublishManifest, $manifestJson + "`n", $utf8NoBom)

Write-Output "Image intake complete: $($rows.Count) files"
Write-Output "Review CSV: $OutputCsv"
Write-Output "Publish manifest: $PublishManifest ($($manifestImages.Count) eligible files)"
Write-Output "Preserved reviewed manifest entries without local source originals: $preservedReviewedCount"
Write-Output "No source images were moved, renamed, overwritten, or deleted."
