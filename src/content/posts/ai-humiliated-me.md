---
title: "How an AI humiliated me with my own six lines of code"
description: "Two tiny PowerShell scripts I'd trusted for ages, one routine AI review, five findings, and a plot twist where the reviewer gets reviewed."
pubDate: 2026-11-03
draft: true
tags: ["ai", "code-review", "powershell", "git", "cmake"]
icon: terminal
---

Today an AI humiliated me. Politely, thoroughly, and in neat numbered bullet points.

The story is told for laughs, but the code is real. Every line below is exactly what I ran, day after day, perfectly happy with it.

## The setup

I'm working on a project I can't talk about yet. (It's very secret. It's also built with CMake, so it can't be *that* exotic.) Like every project, it collected a few helper scripts, and two of them do almost all the daily work.

The first one brings my local `master` up to date with the remote:

```powershell
# update-master.ps1
git fetch origin
git checkout master
git pull origin master
```

Three lines. Fetch, switch, pull. Simple and ideal: what could possibly go wrong? I'd been using it for ages, and everything was nice and neat.

The second one configures the project, builds it, and runs the unit tests:

```powershell
# build-and-test.ps1
cmake -S . -B build -G Ninja
cmake --build build
ctest --test-dir build --output-on-failure
```

Also three lines. Configure with Ninja, build, test, and show the output of any test that fails. Just as simple, just as neat, and it all worked nicely. Well, except for the odd day when some of the tooling wasn't available. But that's the machine's fault, not the script's. Obviously.

## The review nobody needed

Then I asked my current AI agent to check these scripts and open a PR for me. A formality. I was almost sure no review was needed: six lines in total, written by me, battle-tested for ages. What could it possibly find?

Surprise, surprise.

## Your turn

Before you read on, play reviewer yourself. If you think everything is fine, think twice. Read both scripts again, line by line, and ask what each one does when something *doesn't* go to plan. Make sure it's all really correct and neat.

Take your time. I'll wait. The AI didn't need to.

## What the AI found

Five findings for six lines. Here they are, numbered, with the AI's exact words quoted and my excuses after each one.

### 1. Stop when something fails

> Always set `$ErrorActionPreference = "Stop"` so a failing command halts the script.

This one hurt, because I'd had a nagging feeling about it all along. Does my script stop when a command fails, or does it carry on? I never checked. Too lazy. And the answer is: PowerShell carries on. The configure step fails, the build runs anyway; the build fails, and `ctest` happily runs whatever tests the *previous* build left behind. Green tests for code that doesn't even compile.

### 2. Put the tools on PATH

> Add the tool directories to PATH inside the script — the project explicitly states tools are not on PATH by default.

So that's what "sometimes the tooling isn't available" meant. Visual Studio ships CMake, Ninja and clang, but they're only on `PATH` in a developer shell. Open a plain terminal, and they're gone. It was never the machine's fault.

### 3. Build like CI does

> Use the CI CMake flags (clang-cl, Debug, FAULT_INJECTION=ON, WARNINGS_AS_ERRORS=ON) so local runs match CI behavior and check counts.

My local build used the default compiler, the default build type, and no extra checks. CI used clang-cl, a Debug build, fault injection, and warnings as errors. So "it passes on my machine" was true, and it meant nothing.

### 4. Fast-forward only

> Guard `git pull` with `--ff-only` to avoid surprise merge commits on `master`.

If my local `master` had a stray commit of its own, a plain `git pull` would merge `origin/master` into it and create a merge commit nobody asked for. (Newer Git versions may refuse and ask how to reconcile instead, depending on your config. Either way, not what "update master" should do.)

### 5. Check for uncommitted changes

> Check for a dirty working tree before switching branches.

And the nastiest one, especially combined with finding 1. If I have uncommitted changes, `git checkout master` can fail. The script doesn't stop, so `git pull origin master` runs on *whatever branch I'm on*, and merges `master` straight into my feature branch. An unneeded merge, in the wrong place, from a script whose only job was to not touch my work.

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

Comments, usage notes, a dirty-tree guard, a `PATH` fix, a tool check with a helpful message, CI flags, even a coverage switch. Six lines became sixty, and every one of them looks like it knows what it's doing. Humiliation complete. I was ready to merge.

## Plot twist: the reviewer gets reviewed

While writing this post, I asked a second AI (the one helping me put this article together) to double-check the rewrite. And it went straight for finding 1.

`$ErrorActionPreference = "Stop"` only applies to PowerShell's own errors: cmdlets, missing commands, `Write-Error`. Native programs like `git`, `cmake` and `ctest` report failure through their exit code, and PowerShell doesn't treat a non-zero exit code as an error. So the rewritten scripts carry on after a failing command, exactly like mine did.

It didn't just claim this; it proved it. It made a throwaway repository, gave the local `master` a commit that diverges from the remote, and ran the AI's "safe" update script:

```text
fatal: Not possible to fast-forward, aborting.
master is up to date with origin/master
```

Git refuses the update, and the script congratulates you in green, with exit code 0. The build script does the same: the tests fail, and it prints "Build and tests passed" in green. That's *worse* than my original, which at least never claimed success. The header comment even promises "Aborts with a non-zero exit code if... the fast-forward update fails". It doesn't. The same happens in Windows PowerShell 5.1 and in PowerShell 7.

So finding 1 was right about the problem and wrong about the fix.

## How they should have been written

There are two ways to make a native command failure actually stop the script.

**PowerShell 7.4 and newer** has a switch for exactly this. (It first appeared in 7.3, but only as an experimental feature, off by default.) With it, a non-zero exit code becomes a real error, and `"Stop"` stops:

```powershell
#Requires -Version 7.4
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
```

The `#Requires` line matters. Older versions don't complain about the variable; they just create it and carry on, so the script silently falls back to never stopping. With `#Requires`, an older PowerShell refuses to run the script at all. Not sure which version you have? `$PSVersionTable.PSVersion` tells you. As a rule of thumb, `powershell.exe` is Windows PowerShell 5.1, and `pwsh.exe` is PowerShell 7.

But Windows PowerShell 5.1, the one built into Windows, has no such switch. If a script might run there, you have to check `$LASTEXITCODE` after every native command. A tiny helper keeps it readable:

```powershell
# Stop if the last native command (git, cmake, ctest) failed.
# $ErrorActionPreference = "Stop" doesn't cover exit codes.
function Assert-Success([string]$step) {
    if ($LASTEXITCODE -ne 0) {
        throw "$step failed with exit code $LASTEXITCODE"
    }
}
```

Keep `$ErrorActionPreference = "Stop"` anyway: the two cover different failures. `"Stop"` handles PowerShell's own errors, like a missing `cmake`. A program that isn't found never sets an exit code, so without `"Stop"` the helper would see the `0` left over from the last successful `git` and wave the script through. The helper handles programs that run and fail.

Here's the update script with the helper in place. It works in both PowerShell versions:

```powershell
# git_update_master.ps1
# Safely update the local master branch from origin/master.
# Exits with a non-zero code if the working tree is dirty or any git step fails
# (e.g. local master diverged from origin/master).

$ErrorActionPreference = "Stop"

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

In the build script, step 1 stays as it is. Add the same helper at the top, and check every step from configure on. Step 2 changes a little too: with `"Stop"` set, `Write-Error` already ends the script, so the `exit 1` after it never runs. A plain `throw` does the same job without the dead line:

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

One smaller nitpick, while we're here: the tool paths are hard-coded to Visual Studio 18 Community, so on a Professional or Enterprise install they won't match. The tool check in step 2 catches that with a clear message, though, which is exactly what it's for.

## Lessons from a humbling afternoon

- **Short isn't the same as simple.** Six lines had five problems, and none of them were on the happy path. Every one of them lived in the question "what happens when this fails?"
- **If you have a nagging feeling, check it.** I wondered whether my script stopped on errors and didn't bother to look. That one doubt turned out to be finding 1, and the root of finding 5.
- **Review the review.** An AI rewrite can look complete, well commented and confident, and still be wrong in the exact spot it set out to fix. Test the failure path, not just the happy one. Here it took a throwaway repository and one minute.

Final score: AI one, five. Me, zero. AI two, one. I'm still the one who has to merge the PR.

## One last thing: write it down

Here's a confession. When I started this post, I thought I understood the story: my scripts were bad, the AI fixed them, the end. Then I tried to explain it, and the questions started.

Does that PowerShell 7 switch work on older versions? (No. It's 7.4 and newer, and an early draft of this very post said 7.3.) So was the AI's rewrite correct in Windows PowerShell 5.1 or in PowerShell 7? (Neither. I had to see it fail in both to believe it.) And if `"Stop"` does nothing for native commands, why keep it at all? (Because it catches the missing tools that the exit-code check can't see. That one surprised me too.)

Every one of those questions came from writing, not from coding. When you just use a script, "it works" is good enough. When you have to explain it to someone else, every vague "I think it stops on errors" gets dragged into the light and has to answer for itself. It's the same nagging feeling from lesson two, except now you can't ignore it, because a reader will ask.

So that's my real takeaway, and my small rant: write things down. Blog posts, README files, a long comment in the PR. Not because anyone will read them (though I hope you did), but because writing is the review you give your own understanding. I set out to write a funny post about an AI humiliating me. I finished it understanding PowerShell error handling for the first time, crystal clear.

And for once, nobody had to humiliate me to get there. Well. Almost nobody.
