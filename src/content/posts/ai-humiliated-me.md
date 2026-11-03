---
title: "How an AI humiliated me with my own six lines of code"
description: "Git commands I'd typed for ages, wrapped in two tiny PowerShell scripts, one routine AI review, five findings, and a plot twist where the reviewer gets reviewed."
pubDate: 2026-11-03
draft: false
tags: ["ai", "code-review", "powershell", "git", "cmake"]
icon: terminal
---

Today an AI humiliated me. Politely, and in neat numbered bullet points.

The story is told for laughs, but the code is real: the scripts below are exactly what I ran every day, and I was perfectly happy with them.

## The setup

I'm working on a project I can't talk about yet. (It's very secret. It's also built with CMake, so it can't be *that* exotic.) Like every project, it collected a few helper scripts. I used to write a lot of these as cmd batch files, but these days PowerShell is simply more convenient, so the new ones are `.ps1`. I know Git well; PowerShell, not so much yet. Two of the scripts do almost all the daily work.

The first one brings my local `master` up to date with the remote:

```powershell
# update-master.ps1
git fetch origin
git checkout master
git pull origin master
```

Three lines: fetch, switch, pull. What could possibly go wrong? I'd been typing these commands for ages, and everything was nice and neat.

The second one configures the project, builds it, and runs the unit tests:

```powershell
# build-and-test.ps1
cmake -S . -B build -G Ninja
cmake --build build
ctest --test-dir build --output-on-failure
```

Also three lines: configure with Ninja, build, then run the tests and show the output of any that fail. It worked nicely too, except for the odd day when some of the tools weren't available. But that was the machine's fault, of course, not the script's.

## The review nobody needed

Then I asked my AI agent to check these scripts and open a PR for me. I was almost sure no review was needed. It's six lines of commands I'd been typing for ages. What could it possibly find?

Surprise, surprise.

## Your turn

Before you read on, try being the reviewer yourself. If you think everything is fine, think twice: read both scripts again and ask what each line does when something goes wrong.

Take your time, I'll wait. The AI didn't need to.

## What the AI found

It found five problems in six lines. Here they are in the AI's own words, each followed by my excuses.

### 1. Stop when something fails

> Always set `$ErrorActionPreference = "Stop"` so a failing command halts the script.

This one hurt. PowerShell was still fairly new to me, and I'd always had a vague feeling about it: does the script stop when a command fails, or does it carry on? I never got around to checking. It carries on. If the configure step fails, the build runs anyway, and if the build fails, `ctest` happily runs whatever tests the previous build left behind. So you can get green tests for code that doesn't even compile.

### 2. Put the tools on PATH

> Add the tool directories to PATH inside the script — the project explicitly states tools are not on PATH by default.

So that's what my "sometimes the tools aren't available" was about. Visual Studio comes with CMake, Ninja and clang, but they're only on `PATH` in its developer shell. In a plain terminal, they simply aren't there. So it wasn't the machine's fault after all.

### 3. Build like CI does

> Use the CI CMake flags (clang-cl, Debug, FAULT_INJECTION=ON, WARNINGS_AS_ERRORS=ON) so local runs match CI behavior and check counts.

My local build used the default compiler and build type. CI builds with clang-cl in Debug, with fault injection on and warnings treated as errors. So "it passes on my machine" was true, but it didn't tell me much about CI.

### 4. Fast-forward only

> Guard `git pull` with `--ff-only` to avoid surprise merge commits on `master`.

If my local `master` had a stray commit of its own, a plain `git pull` would merge `origin/master` into it and create a merge commit nobody asked for. (Newer Git versions may refuse and ask how to reconcile instead, depending on your config. Either way, that's not what a script called "update master" should do.)

### 5. Check for uncommitted changes

> Check for a dirty working tree before switching branches.

This is the nastiest one, together with finding 1. With uncommitted changes, `git checkout master` can fail. The script doesn't stop, so `git pull origin master` runs on whatever branch I'm on and merges `master` into my feature branch. I'd get a merge I never wanted, from a script that was only supposed to update `master`.

## The rewrite

Along with the findings, the AI rewrote both scripts. Here they are, exactly as it produced them.

```powershell
# git_update_master.ps1
# Safely update the local master branch from origin/master.
#
# Usage:
#   .\scripts\git_update_master.ps1
#
# Aborts with a non-zero exit code if the working tree is dirty or if the
# fast-forward update fails (e.g. local master diverged from origin/master).

$ErrorActionPreference = "Stop"

# 1. Abort if the working tree is dirty — switching branches would be blocked
#    or could clobber uncommitted changes.
$status = git status --porcelain
if ($status) {
    Write-Error "Working tree is dirty. Commit or stash your changes before updating master."
    exit 1
}

# 2. Fetch the latest from origin.
git fetch origin

# 3. Switch to master.
git checkout master

# 4. Fast-forward only: refuse if local master diverged from origin/master so
#    no surprise merge commit is created.
git pull --ff-only origin master

Write-Host "master is up to date with origin/master" -ForegroundColor Green
```

```powershell
# build_test.ps1
# Configure, build, and test the project using clang + Ninja with CI flags.
#
# Usage:
#   .\scripts\build_test.ps1                # build + run tests
#   .\scripts\build_test.ps1 -Coverage      # build + coverage gate
#
# The configure flags match CI exactly:
#   -G Ninja -DCMAKE_C_COMPILER=clang-cl -DCMAKE_BUILD_TYPE=Debug
#   -DMYPROJ_FAULT_INJECTION=ON -DMYPROJ_WARNINGS_AS_ERRORS=ON

param(
    [switch]$Coverage
)

$ErrorActionPreference = "Stop"

# 1. Ensure required tool directories are on PATH (they are not on PATH by
#    default on Windows — see AGENTS.md "Build / toolchain").
$toolDirs = @(
    "C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin",
    "C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja",
    "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Tools\Llvm\x64\bin"
)
foreach ($dir in $toolDirs) {
    if (-not ($env:PATH -split ';' -contains $dir)) {
        $env:PATH = "$dir;$env:PATH"
    }
}

# 2. Verify the required tools are available.
foreach ($tool in @("cmake", "ninja", "clang-cl")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Error "$tool not found on PATH. Add the Visual Studio tool directories to PATH or run from a developer shell."
        exit 1
    }
}

# 3. Configure (CI flags).
cmake -S . -B build -G Ninja `
    -DCMAKE_C_COMPILER=clang-cl `
    -DCMAKE_BUILD_TYPE=Debug `
    -DMYPROJ_FAULT_INJECTION=ON `
    -DMYPROJ_WARNINGS_AS_ERRORS=ON

# 4. Build.
cmake --build build

# 5. Test.
if ($Coverage) {
    cmake --build build --target coverage
} else {
    ctest --test-dir build --output-on-failure
}

Write-Host "Build and tests passed" -ForegroundColor Green
```

Six lines became about sixty, with comments, usage notes, a fix for every finding and even a coverage switch. It looked very thorough, and I was ready to merge it and move on.

## Plot twist: the reviewer gets reviewed

While writing this post, I asked a second AI, the one helping me with the article, to double-check the rewrite. It went straight for finding 1.

`$ErrorActionPreference = "Stop"` only applies to PowerShell's own errors: cmdlets, missing commands, `Write-Error`. Native programs like `git`, `cmake` and `ctest` report failure through their exit code, and PowerShell doesn't treat a non-zero exit code as an error. So the rewritten scripts carry on after a failing command, exactly like mine did.

To show it, it made a throwaway repository, gave the local `master` a commit that the remote doesn't have, and ran the AI's "safe" update script:

```text
fatal: Not possible to fast-forward, aborting.
master is up to date with origin/master
```

Git refuses the update, and then the script tells you in green that everything is fine, and exits with code 0. The build script behaves the same way: if the tests fail, it still prints "Build and tests passed". In a way, that's worse than my original, which at least never claimed success. The header comment even promises to abort "with a non-zero exit code if… the fast-forward update fails". It doesn't, in Windows PowerShell 5.1 or in PowerShell 7.

So finding 1 spotted the right problem, but its fix didn't work.

## How they should have been written

There are two ways to make a native command failure actually stop the script.

In PowerShell 7.4 and newer, there's a setting for this. (It first appeared in 7.3, but only as an experimental feature, off by default.) Turn it on, and a non-zero exit code becomes a real error that `"Stop"` stops on:

```powershell
#Requires -Version 7.4
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
```

I added `#Requires` because older versions don't complain about the unknown variable. They just create it and carry on, and the script quietly goes back to never stopping. With `#Requires`, an older PowerShell refuses to run the script at all. To see which version you have, run `$PSVersionTable.PSVersion`. Usually `powershell.exe` is Windows PowerShell 5.1, and `pwsh.exe` is PowerShell 7.

But Windows PowerShell 5.1, the one built into Windows, has no such setting. If a script might run there, you have to check `$LASTEXITCODE` after every native command. A tiny helper keeps it readable:

```powershell
# Stop if the last native command (git, cmake, ctest) failed.
# $ErrorActionPreference = "Stop" doesn't cover exit codes.
# Needed for Windows PowerShell 5.1. It works in PowerShell 7 too, but on 7.4+
# you can use $PSNativeCommandUseErrorActionPreference = $true instead.
function Assert-Success([string]$step) {
    if ($LASTEXITCODE -ne 0) {
        throw "$step failed with exit code $LASTEXITCODE"
    }
}
```

You still need `$ErrorActionPreference = "Stop"`, because it covers a different kind of failure: PowerShell's own errors, like a missing `cmake`. A program that isn't found never sets an exit code, so without `"Stop"` the helper would see the `0` left over from the last successful `git` and let the script carry on. The helper is for programs that do run, and fail.

One thing that confused me at first: how does `Assert-Success "Build"` know which command it's checking? It doesn't. `"Build"` is only a label for the error message. `$LASTEXITCODE` always holds the exit code of the most recent native program, so the helper has to be called right after the command it checks. Put another command in between, and it checks that one instead:

```powershell
cmake --build build      # fails, exit code 1
git rev-parse HEAD       # succeeds, so $LASTEXITCODE is now 0
Assert-Success "Build"   # sees 0, and the failed build slips through
```

That's why every native command in the scripts below has its own `Assert-Success` on the very next line.

Here's the update script with the helper in place. It works in both PowerShell versions:

```powershell
# git_update_master.ps1
# Safely update the local master branch from origin/master.
# Exits with a non-zero code if the working tree is dirty or any git step fails
# (e.g. local master diverged from origin/master).

$ErrorActionPreference = "Stop"

# Stop if the last git command failed: "Stop" doesn't cover exit codes.
# Needed for Windows PowerShell 5.1; on PowerShell 7.4+ the built-in
# $PSNativeCommandUseErrorActionPreference = $true does the same job.
function Assert-Success([string]$step) {
    if ($LASTEXITCODE -ne 0) {
        throw "$step failed with exit code $LASTEXITCODE"
    }
}

# 1. Abort if the working tree is dirty.
$status = git status --porcelain
Assert-Success "git status"
if ($status) {
    throw "Working tree is dirty. Commit or stash your changes before updating master."
}

# 2. Fetch the latest from origin.
git fetch origin
Assert-Success "git fetch"

# 3. Switch to master. If this fails, we must not pull into the current branch.
git checkout master
Assert-Success "git checkout master"

# 4. Fast-forward only: no surprise merge commits.
git pull --ff-only origin master
Assert-Success "git pull --ff-only"

Write-Host "master is up to date with origin/master" -ForegroundColor Green
```

On the diverged repository, it now stops with `git pull --ff-only failed with exit code 128` and exit code 1. On a clean one that's just behind, it fast-forwards and says so.

In the build script, step 1 stays as it is. Add the same helper right after `$ErrorActionPreference = "Stop"` (not above `param()`, which has to come first), and check every step from configure on. Step 2 changes a little too: with `"Stop"` set, `Write-Error` already ends the script, so the `exit 1` after it never runs. A plain `throw` does the same job without the dead line:

```powershell
# 2. Verify the required tools are available.
foreach ($tool in @("cmake", "ninja", "clang-cl")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "$tool not found on PATH. Add the Visual Studio tool directories to PATH or run from a developer shell."
    }
}

# 3. Configure (CI flags).
cmake -S . -B build -G Ninja `
    -DCMAKE_C_COMPILER=clang-cl `
    -DCMAKE_BUILD_TYPE=Debug `
    -DMYPROJ_FAULT_INJECTION=ON `
    -DMYPROJ_WARNINGS_AS_ERRORS=ON
Assert-Success "Configure"

# 4. Build.
cmake --build build
Assert-Success "Build"

# 5. Test.
if ($Coverage) {
    cmake --build build --target coverage
    Assert-Success "Coverage"
} else {
    ctest --test-dir build --output-on-failure
    Assert-Success "Tests"
}

Write-Host "Build and tests passed" -ForegroundColor Green
```

Now the green message only shows up when it's true.

One small nitpick: the tool paths are hard-coded for Visual Studio 18 Community, so they won't match a Professional or Enterprise install. The tool check in step 2 catches that, though, with a clear message.

## What I learned

Six lines had five problems, and none of them showed up as long as everything went well. They were all about what happens when something fails, which is the part I never tested. I'd even had a feeling that something was off, and didn't check.

The second lesson came from the second AI. A review is still worth checking, even when it comes from an AI and looks thorough and confident. This one was wrong in exactly the place it set out to fix, and finding that out took a throwaway repository and about a minute.

And one more, which I didn't expect. When I started this post, I thought I knew the story: my scripts were bad, the AI fixed them, the end. Then I tried to explain it, and the questions kept coming. Does that PowerShell 7 setting work on older versions? (No. It needs 7.4, and an early draft of this post said 7.3.) Was the AI's rewrite correct in Windows PowerShell 5.1, or in PowerShell 7? (In neither. I didn't believe it until I saw it fail in both.) And if `"Stop"` does nothing for native commands, why keep it? (Because it catches missing tools, which the exit-code check can't see. That one surprised me too.)

I'd never have asked any of this while just using the scripts. As long as they run, "it works" is good enough. Explaining them to someone else is different: every "I think it stops on errors" has to be checked, because a reader will ask. It was the same vague feeling I'd been ignoring all along, and writing finally made me look into it.

So here's my small rant: write things down, even if it's just a long PR description. Maybe nobody will read it (though I hope you did), but you'll understand your own topic much better afterwards. I meant to write a funny post about an AI humiliating me, and I finished it actually understanding PowerShell error handling.

Final score: AI one, five. Me, zero. AI two, one. And I'm still the one who has to merge the PR.
