[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('brief', 'validate', 'checkpoint', 'handoff')]
    [string]$Action = 'brief',

    [string]$Task,
    [string]$Owner,
    [string]$Summary,
    [string]$NextAction,

    [ValidateSet('verified', 'claimed', 'stale', 'unknown')]
    [string]$Status = 'claimed',

    [string]$VerificationCommand = '',
    [string]$VerificationResult = '',
    [string]$Notes = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$memoryRoot = Join-Path $repoRoot '.codex\project-memory'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$allowedStatuses = @('verified', 'claimed', 'stale', 'unknown')

function Invoke-Git {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    $output = @(& git -C $repoRoot @Arguments 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed: $($output -join [Environment]::NewLine)"
    }
    return $output
}

function Get-GitValue {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    $value = Invoke-Git -Arguments $Arguments | Select-Object -First 1
    if ($null -eq $value) { return '' }
    return $value.ToString().Trim()
}

function Get-RepoFacts {
    $statusLines = @(Invoke-Git -Arguments @('status', '--short'))
    return [ordered]@{
        repository = $repoRoot
        remote = Get-GitValue -Arguments @('remote', 'get-url', 'origin')
        branch = Get-GitValue -Arguments @('branch', '--show-current')
        commit = Get-GitValue -Arguments @('rev-parse', 'HEAD')
        dirty = ($statusLines.Count -gt 0)
        status = $statusLines
    }
}

function Get-SafeSlug {
    param([Parameter(Mandatory = $true)][string]$Value)

    $slug = $Value.Trim().ToLowerInvariant()
    $slug = [regex]::Replace($slug, '[^a-z0-9._-]+', '-')
    $slug = $slug.Trim('-')
    if ([string]::IsNullOrWhiteSpace($slug)) { $slug = 'task' }
    if ($slug.Length -gt 64) { $slug = $slug.Substring(0, 64).Trim('-') }
    return $slug
}

function Assert-RecordArguments {
    param([switch]$RequireNextAction)

    foreach ($name in @('Task', 'Owner', 'Summary')) {
        $value = Get-Variable -Name $name -ValueOnly
        if ([string]::IsNullOrWhiteSpace($value)) {
            throw "-$name is required for '$Action'."
        }
    }
    if ($RequireNextAction -and [string]::IsNullOrWhiteSpace($NextAction)) {
        throw "-NextAction is required for 'handoff'."
    }
}

function Write-NewUtf8File {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $parent = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $parent)) {
        [System.IO.Directory]::CreateDirectory($parent) | Out-Null
    }

    $stream = New-Object System.IO.FileStream(
        $Path,
        [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::Write,
        [System.IO.FileShare]::None
    )
    try {
        $writer = New-Object System.IO.StreamWriter($stream, $utf8NoBom)
        try { $writer.Write($Content) } finally { $writer.Dispose() }
    } finally {
        if ($null -ne $stream) { $stream.Dispose() }
    }
}

function Test-JsonProperty {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )
    return $Object.PSObject.Properties.Name -contains $Name
}

function Add-ValidationError {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][System.Collections.Generic.List[string]]$Errors,
        [Parameter(Mandatory = $true)][string]$Message
    )
    $Errors.Add($Message)
}

function Invoke-Validation {
    $errors = New-Object 'System.Collections.Generic.List[string]'
    $warnings = New-Object 'System.Collections.Generic.List[string]'
    $requiredPaths = @(
        'PROJECT_CONTEXT.md',
        '.codex\project-memory\README.md',
        '.codex\project-memory\ACCOUNT_SETUP.md',
        '.codex\project-memory\current-state.json',
        '.codex\project-memory\decisions',
        '.codex\project-memory\evidence',
        '.codex\project-memory\handoffs',
        '.codex\project-memory\templates'
    )

    foreach ($relativePath in $requiredPaths) {
        if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $relativePath))) {
            Add-ValidationError -Errors $errors -Message "Missing required path: $relativePath"
        }
    }

    $statePath = Join-Path $memoryRoot 'current-state.json'
    if (Test-Path -LiteralPath $statePath) {
        try {
            $state = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
            foreach ($property in @('schema_version', 'project', 'authority', 'snapshot')) {
                if (-not (Test-JsonProperty -Object $state -Name $property)) {
                    Add-ValidationError -Errors $errors -Message "current-state.json is missing '$property'."
                }
            }
            if ((Test-JsonProperty -Object $state -Name 'schema_version') -and $state.schema_version -ne 1) {
                Add-ValidationError -Errors $errors -Message 'current-state.json schema_version must be 1.'
            }
        } catch {
            Add-ValidationError -Errors $errors -Message "Invalid current-state.json: $($_.Exception.Message)"
        }
    }

    $evidenceIds = @{}
    $evidenceRoot = Join-Path $memoryRoot 'evidence'
    if (Test-Path -LiteralPath $evidenceRoot) {
        $evidenceFiles = @(Get-ChildItem -LiteralPath $evidenceRoot -Recurse -File -Filter '*.json')
        foreach ($file in $evidenceFiles) {
            try {
                $record = Get-Content -Raw -LiteralPath $file.FullName | ConvertFrom-Json
                foreach ($property in @('schema_version', 'evidence_id', 'task_ref', 'owner', 'captured_at', 'status', 'claim', 'source')) {
                    if (-not (Test-JsonProperty -Object $record -Name $property)) {
                        Add-ValidationError -Errors $errors -Message "$($file.FullName) is missing '$property'."
                    }
                }

                if ((Test-JsonProperty -Object $record -Name 'schema_version') -and $record.schema_version -ne 1) {
                    Add-ValidationError -Errors $errors -Message "$($file.FullName) schema_version must be 1."
                }
                if ((Test-JsonProperty -Object $record -Name 'status') -and $allowedStatuses -notcontains $record.status) {
                    Add-ValidationError -Errors $errors -Message "$($file.FullName) has invalid status '$($record.status)'."
                }
                if (Test-JsonProperty -Object $record -Name 'captured_at') {
                    $parsedTimestamp = [DateTimeOffset]::MinValue
                    if (-not [DateTimeOffset]::TryParse($record.captured_at, [ref]$parsedTimestamp)) {
                        Add-ValidationError -Errors $errors -Message "$($file.FullName) has invalid captured_at."
                    }
                }
                if (Test-JsonProperty -Object $record -Name 'evidence_id') {
                    if ($evidenceIds.ContainsKey($record.evidence_id)) {
                        Add-ValidationError -Errors $errors -Message "Duplicate evidence_id '$($record.evidence_id)'."
                    } else {
                        $evidenceIds[$record.evidence_id] = $file.FullName
                    }
                }
            } catch {
                Add-ValidationError -Errors $errors -Message "Invalid evidence JSON $($file.FullName): $($_.Exception.Message)"
            }
        }
    }

    $decisionRoot = Join-Path $memoryRoot 'decisions'
    if (Test-Path -LiteralPath $decisionRoot) {
        foreach ($file in @(Get-ChildItem -LiteralPath $decisionRoot -File -Filter 'ADR-*.md')) {
            $content = Get-Content -Raw -LiteralPath $file.FullName
            foreach ($heading in @('## Context', '## Decision', '## Consequences', '## Evidence')) {
                if ($content -notmatch [regex]::Escape($heading)) {
                    Add-ValidationError -Errors $errors -Message "$($file.Name) is missing heading '$heading'."
                }
            }
        }
    }

    $scanFiles = @()
    $contextPath = Join-Path $repoRoot 'PROJECT_CONTEXT.md'
    if (Test-Path -LiteralPath $contextPath) { $scanFiles += Get-Item -LiteralPath $contextPath }
    if (Test-Path -LiteralPath $memoryRoot) {
        $scanFiles += Get-ChildItem -LiteralPath $memoryRoot -Recurse -File |
            Where-Object { $_.FullName -notmatch '[\\/]templates[\\/]' }
    }

    $secretPatterns = [ordered]@{
        'private key material' = '-----BEGIN [A-Z ]*PRIVATE KEY-----'
        'GitHub token' = '(?i)\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b'
        'API token' = '\bsk-[A-Za-z0-9_-]{20,}\b'
        'AWS access key' = '\bAKIA[0-9A-Z]{16}\b'
        'credential assignment' = '(?i)(?:password|passwd|api[_-]?key|token)\s*[:=]\s*["'']?[^\s"''<>]{12,}'
    }

    foreach ($file in $scanFiles) {
        $content = Get-Content -Raw -LiteralPath $file.FullName
        foreach ($label in $secretPatterns.Keys) {
            if ($content -match $secretPatterns[$label]) {
                Add-ValidationError -Errors $errors -Message "Possible $label in $($file.FullName)."
            }
        }
    }

    $repoFacts = Get-RepoFacts
    if (Test-Path -LiteralPath $statePath) {
        try {
            $state = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
            if ($state.snapshot.source_commit -ne $repoFacts.commit) {
                $warnings.Add("Snapshot source_commit differs from current HEAD; this is allowed, but verify whether the snapshot is stale.")
            }
        } catch {
            # The parse error is already reported above.
        }
    }

    foreach ($warning in $warnings) { Write-Warning $warning }
    if ($errors.Count -gt 0) {
        foreach ($validationError in $errors) { Write-Error $validationError -ErrorAction Continue }
        throw "Project-memory validation failed with $($errors.Count) error(s)."
    }

    Write-Host "Project-memory validation passed: $($evidenceIds.Count) evidence record(s), $($warnings.Count) warning(s)."
}

function Show-Brief {
    Invoke-Validation
    $facts = Get-RepoFacts
    $state = Get-Content -Raw -LiteralPath (Join-Path $memoryRoot 'current-state.json') | ConvertFrom-Json
    $handoffRoot = Join-Path $memoryRoot 'handoffs'
    $latestHandoff = $null
    if (Test-Path -LiteralPath $handoffRoot) {
        $latestHandoff = Get-ChildItem -LiteralPath $handoffRoot -Recurse -File -Filter '*.md' |
            Where-Object { $_.Name -ne 'README.md' } |
            Sort-Object FullName -Descending |
            Select-Object -First 1
    }

    Write-Host '=== Agentstrip project brief ==='
    Write-Host "Repository : $($facts.repository)"
    Write-Host "Remote     : $($facts.remote)"
    Write-Host "Branch     : $($facts.branch)"
    Write-Host "HEAD       : $($facts.commit)"
    Write-Host "Dirty      : $($facts.dirty)"
    Write-Host "Snapshot   : $($state.snapshot.status) at $($state.snapshot.captured_at)"
    Write-Host "Production : $($state.snapshot.production.status)"
    if ($facts.status.Count -gt 0) {
        Write-Host 'Working-tree changes:'
        $facts.status | ForEach-Object { Write-Host "  $_" }
    }
    if ($null -ne $latestHandoff) {
        Write-Host "Latest handoff: $($latestHandoff.FullName)"
        Write-Host (Get-Content -Raw -LiteralPath $latestHandoff.FullName)
    } else {
        Write-Host 'Latest handoff: none'
    }
}

function New-Checkpoint {
    Assert-RecordArguments
    $facts = Get-RepoFacts
    $now = [DateTime]::UtcNow
    $timestamp = $now.ToString('yyyy-MM-ddTHH:mm:ssZ')
    $fileStamp = $now.ToString('yyyyMMddTHHmmssZ')
    $taskSlug = Get-SafeSlug -Value $Task
    $evidenceId = "ev-$fileStamp-$taskSlug"
    $record = [ordered]@{
        schema_version = 1
        evidence_id = $evidenceId
        task_ref = $Task
        owner = $Owner
        captured_at = $timestamp
        status = $Status
        claim = $Summary
        source = [ordered]@{
            kind = 'git'
            repository = $facts.remote
            commit = $facts.commit
            branch = $facts.branch
            worktree = $facts.repository
            dirty = $facts.dirty
        }
        verification = [ordered]@{
            command = $VerificationCommand
            result = $VerificationResult
        }
        notes = $Notes
    }

    $path = Join-Path $memoryRoot ("evidence\{0}\{1}\{2}-{3}.json" -f $now.ToString('yyyy'), $now.ToString('MM'), $fileStamp, $taskSlug)
    $json = $record | ConvertTo-Json -Depth 8
    Write-NewUtf8File -Path $path -Content ($json + [Environment]::NewLine)
    Write-Host "Created checkpoint: $path"
    Write-Host "Evidence ID: $evidenceId"
}

function New-Handoff {
    Assert-RecordArguments -RequireNextAction
    $facts = Get-RepoFacts
    $now = [DateTime]::UtcNow
    $timestamp = $now.ToString('yyyy-MM-ddTHH:mm:ssZ')
    $fileStamp = $now.ToString('yyyyMMddTHHmmssZ')
    $taskSlug = Get-SafeSlug -Value $Task
    $dirtyLabel = if ($facts.dirty) { 'dirty' } else { 'clean' }
    $statusText = if ($facts.status.Count -gt 0) { ($facts.status | ForEach-Object { "- $_" }) -join [Environment]::NewLine } else { '- none' }

    $content = @"
# Handoff: $Task

- Status: $Status
- Owner: $Owner
- Captured at: $timestamp
- Branch: $($facts.branch)
- Commit: $($facts.commit)
- Worktree: $($facts.repository)
- Working tree: $dirtyLabel

## Current state

$Summary

## Verified evidence

- Verification command: $VerificationCommand
- Verification result: $VerificationResult

## Files changed

$statusText

## Risks and unknowns

$Notes

## Next exact action

$NextAction
"@

    $path = Join-Path $memoryRoot ("handoffs\{0}\{1}\{2}-{3}.md" -f $now.ToString('yyyy'), $now.ToString('MM'), $fileStamp, $taskSlug)
    Write-NewUtf8File -Path $path -Content ($content.TrimStart() + [Environment]::NewLine)
    Write-Host "Created handoff: $path"
}

switch ($Action) {
    'brief' { Show-Brief }
    'validate' { Invoke-Validation }
    'checkpoint' { New-Checkpoint }
    'handoff' { New-Handoff }
}
