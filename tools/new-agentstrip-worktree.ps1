[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("account1", "account2")]
    [string]$Account,

    [Parameter(Mandatory = $true)]
    [ValidatePattern("^[a-z0-9][a-z0-9-]{2,60}$")]
    [string]$TaskSlug,

    [string]$BaseRef = "origin/main",
    [string]$WorktreesRoot = "E:\Agentstrip-worktrees",
    [string]$ArtifactsRoot = "E:\Agentstrip-artifacts",
    [switch]$SkipFetch
)

$ErrorActionPreference = "Stop"

$repositoryRoot = (git -C $PSScriptRoot rev-parse --show-toplevel).Trim()
if (-not $repositoryRoot) {
    throw "Unable to resolve the Agentstrip repository root."
}

if (-not $SkipFetch) {
    git -C $repositoryRoot fetch origin main
    if ($LASTEXITCODE -ne 0) {
        throw "git fetch origin main failed."
    }
}

git -C $repositoryRoot rev-parse --verify --quiet $BaseRef | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Base ref does not exist: $BaseRef"
}

$branchName = "codex/$TaskSlug"
git -C $repositoryRoot show-ref --verify --quiet "refs/heads/$branchName"
if ($LASTEXITCODE -eq 0) {
    throw "Local branch already exists: $branchName"
}

$accountRoot = [System.IO.Path]::GetFullPath((Join-Path $WorktreesRoot "active\$Account"))
$worktreePath = [System.IO.Path]::GetFullPath((Join-Path $accountRoot $TaskSlug))
if (-not $worktreePath.StartsWith("$accountRoot\", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Resolved worktree path escaped the account root."
}
if (Test-Path -LiteralPath $worktreePath) {
    throw "Worktree path already exists: $worktreePath"
}

$artifactPath = [System.IO.Path]::GetFullPath((Join-Path $ArtifactsRoot "$(Get-Date -Format 'yyyy-MM-dd')\$TaskSlug"))
New-Item -ItemType Directory -Path $accountRoot -Force | Out-Null
New-Item -ItemType Directory -Path $artifactPath -Force | Out-Null

git -C $repositoryRoot worktree add -b $branchName $worktreePath $BaseRef
if ($LASTEXITCODE -ne 0) {
    throw "git worktree add failed."
}

[pscustomobject]@{
    Account       = $Account
    Branch        = $branchName
    BaseRef       = $BaseRef
    Worktree      = $worktreePath
    ArtifactPath  = $artifactPath
    NextCommand   = "Set-Location -LiteralPath '$worktreePath'"
}
