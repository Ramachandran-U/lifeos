<#
.SYNOPSIS
  Helpers to spin up / tear down isolated Claude Code worktrees for LifeOS.

.DESCRIPTION
  A worktree is a second working directory backed by the same .git -- its own
  files and branch, so a parallel Claude session can never collide with another
  or leak uncommitted work into your main checkout.

  This is the deps-installing alternative to `claude --worktree <name>`: it
  creates the worktree, copies the gitignored env files (same list as
  .worktreeinclude), runs `npm ci`, and hands you a ready-to-go directory.
  (`claude --worktree` also works and copies env via .worktreeinclude, but does
  NOT install dependencies -- you would run `npm ci` yourself inside it.)

  IMPORTANT: never symlink/junction node_modules between worktrees. Metro
  mis-resolves symlinked modules, and deleting the link can wipe the real
  node_modules. Each worktree gets its own real install. That is the point.

.EXAMPLE
  . .\scripts\worktree.ps1            # dot-source once to load the functions
  New-LifeOSWorktree goals            # create + copy env + npm ci, ready for `claude`
  New-LifeOSWorktree health -Launch   # ...and start Claude in it right away
  New-LifeOSWorktree quickfix -NoInstall   # skip the slow npm ci (no tests/app yet)
  Get-LifeOSWorktrees                 # list every worktree
  Remove-LifeOSWorktree goals -DeleteBranch   # tear it down when its PR is merged
#>

function Get-LifeOSRepoRoot {
    $root = (git rev-parse --show-toplevel 2>$null)
    if (-not $root) { return $null }
    return ($root -replace '/', '\')
}

function New-LifeOSWorktree {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        # Branch worktrees off the clean integration branch by default, so each
        # session starts from the latest merged state, not your local mess.
        [string]$Base = 'origin/lifeosv1',
        [switch]$NoInstall,
        [switch]$Launch
    )

    $repo = Get-LifeOSRepoRoot
    if (-not $repo) { Write-Error 'Not inside a git repository.'; return }

    $branch = "worktree-$Name"
    $dest = Join-Path $repo ".claude\worktrees\$Name"

    if (Test-Path $dest) { Write-Error "Worktree already exists: $dest"; return }

    Write-Host '==> Fetching latest from origin...' -ForegroundColor Cyan
    git fetch origin --quiet

    Write-Host "==> Creating worktree '$Name' (branch '$branch') from $Base" -ForegroundColor Cyan
    git worktree add -b $branch $dest $Base
    if ($LASTEXITCODE -ne 0) { Write-Error 'git worktree add failed.'; return }

    # Mirror .worktreeinclude: copy gitignored env files so the app boots.
    foreach ($f in @('.env', '.env.test', '.env.local')) {
        $src = Join-Path $repo $f
        if (Test-Path $src) {
            Copy-Item $src (Join-Path $dest $f) -Force
            Write-Host "    copied $f" -ForegroundColor DarkGray
        }
    }

    if (-not $NoInstall) {
        Write-Host '==> npm ci  (the slow part for Expo: full node_modules)' -ForegroundColor Cyan
        Push-Location $dest
        npm ci
        $code = $LASTEXITCODE
        Pop-Location
        if ($code -ne 0) {
            Write-Warning 'npm ci failed. Open the worktree and fix deps before running tests/app.'
        }
    }
    else {
        Write-Host '==> Skipped npm ci (-NoInstall). Run it before jest/tsc/expo.' -ForegroundColor Yellow
    }

    Write-Host ''
    Write-Host "Worktree ready: $dest" -ForegroundColor Green
    if ($Launch) {
        Push-Location $dest
        claude
        Pop-Location
    }
    else {
        Write-Host 'Start a session with:' -ForegroundColor Green
        Write-Host "    cd `"$dest`"; claude" -ForegroundColor White
    }
}

function Get-LifeOSWorktrees {
    git worktree list
}

function Remove-LifeOSWorktree {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        # Use -Force to discard uncommitted changes in the worktree.
        [switch]$Force,
        # Also delete the worktree-<name> branch.
        [switch]$DeleteBranch
    )

    $repo = Get-LifeOSRepoRoot
    if (-not $repo) { Write-Error 'Not inside a git repository.'; return }

    $dest = Join-Path $repo ".claude\worktrees\$Name"
    $gitArgs = @('worktree', 'remove', $dest)
    if ($Force) { $gitArgs += '--force' }

    git @gitArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Error 'worktree remove failed (uncommitted changes? re-run with -Force).'
        return
    }

    if ($DeleteBranch) { git branch -D "worktree-$Name" }
    Write-Host "Removed worktree '$Name'." -ForegroundColor Green
}
