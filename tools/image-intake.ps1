param(
    [Parameter(Mandatory = $false)]
    [string]$InputDirectory = "E:\Agentstrip\wandermind-studio\frontend\assets\images",

    [Parameter(Mandatory = $false)]
    [string]$OutputCsv = "E:\Agentstrip\wandermind-studio\frontend\assets\data\image-intake-review.csv"
)

$ErrorActionPreference = "Stop"

$resolvedInput = (Resolve-Path -LiteralPath $InputDirectory).Path
$outputParent = Split-Path -Parent $OutputCsv
if (-not (Test-Path -LiteralPath $outputParent)) {
    New-Item -ItemType Directory -Path $outputParent -Force | Out-Null
}

Add-Type -AssemblyName System.Drawing

function Get-ImageHints {
    param([string]$FileName)

    $name = $FileName.ToLowerInvariant()
    $category = "unclassified"
    $tags = New-Object System.Collections.Generic.List[string]
    $captureStyle = "unknown"
    $rightsStatus = "unknown"
    $publishable = $false

    if ($name -match "dicky|gede|tourist") {
        $category = "people"
        $captureStyle = "phone_authentic"
        $tags.Add("driver")
    }
    if ($name -match "car|vehicle") {
        $category = "places"
        $captureStyle = "phone_authentic"
        $tags.Add("vehicle")
    }
    if ($name -match "temple|pura|tirta|lempuyang|besakih|uluwatu|tanah lot|ulun danu|saraswati|gwk|garuda") {
        $category = "places"
        $tags.Add("culture")
        $tags.Add("temple")
    }
    if ($name -match "yoga|chi|healing|intuitive|sound") {
        $category = "experiences"
        $tags.Add("wellness")
    }
    if ($name -match "beach|ocean|sunset|cliff|aerial|shore|coast") {
        if ($category -eq "unclassified") { $category = "landscapes" }
        $tags.Add("coast")
    }
    if ($name -match "nyepi|galungan") {
        $category = "culture"
        $tags.Add("festival")
    }
    if ($name -match "dicky|gede") {
        $rightsStatus = "user_provided_with_consent"
        $publishable = $true
    }
    if ($name -match "lempuyang temple") {
        $rightsStatus = "watermarked"
        $publishable = $false
    }

    [pscustomobject]@{
        Category = $category
        Tags = ($tags | Select-Object -Unique) -join ";"
        CaptureStyle = $captureStyle
        RightsStatus = $rightsStatus
        Publishable = $publishable
    }
}

$rows = foreach ($file in Get-ChildItem -LiteralPath $resolvedInput -File | Where-Object {
    $_.Extension.ToLowerInvariant() -in ".jpg", ".jpeg", ".png", ".webp"
}) {
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

    $hints = Get-ImageHints -FileName $file.Name
    [pscustomobject]@{
        Filename = $file.Name
        RelativePath = "assets/images/$($file.Name)"
        Bytes = $file.Length
        Width = $width
        Height = $height
        Sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        SuggestedCategory = $hints.Category
        SuggestedTags = $hints.Tags
        SuggestedCaptureStyle = $hints.CaptureStyle
        RightsStatus = $hints.RightsStatus
        Publishable = $hints.Publishable
        HumanConfirmed = $false
        IntendedUse = ""
        AltTextZh = ""
        AltTextEn = ""
        ReadError = $readError
    }
}

$rows |
    Sort-Object Filename |
    Export-Csv -LiteralPath $OutputCsv -NoTypeInformation -Encoding UTF8

Write-Output "Image intake complete: $($rows.Count) files"
Write-Output "Review CSV: $OutputCsv"
Write-Output "No source images were moved, renamed, overwritten, or deleted."
