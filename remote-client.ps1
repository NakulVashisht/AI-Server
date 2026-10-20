# ═══════════════════════════════════════════════════════════════
#  AI-Server Remote Agent Client (PowerShell)
#  Full-featured remote client with all agent capabilities.
#  Usage: irm <your-hosted-url> | iex
# ═══════════════════════════════════════════════════════════════

# ─── Resolve Server URL (auto-discover tunnel) ───
function Get-ServerUrl {
    # 1. Try local server first
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:3000/chat" -Method Post `
            -Headers @{'Content-Type'='application/json'} `
            -Body (@{prompt="ping"}|ConvertTo-Json) -TimeoutSec 2 -ErrorAction Stop
        return "http://127.0.0.1:3000"
    } catch {}

    # 2. Fetch from ntfy tunnel sync
    try {
        $raw = (Invoke-RestMethod -Uri "https://ntfy.sh/ghosty001_ai_tunnel_sync/raw?poll=1" -TimeoutSec 5)
        $lines = ($raw -split "`n") | Where-Object { $_.Trim() -match "^https?://" }
        if ($lines.Count -gt 0) {
            return ($lines[-1]).Trim()
        }
    } catch {}

    Write-Host "`n  [!] Could not connect to AI server (local or tunnel)." -ForegroundColor Red
    Write-Host "      Make sure the server is running: npm run dev`n" -ForegroundColor DarkGray
    exit 1
}

# ─── State ───
$script:ServerUrl     = ""
$script:AgentMode     = $true
$script:History       = [System.Collections.ArrayList]::new()
$script:LastCode      = $null   # last code_response object
$script:LastWritten   = @()     # last written file paths
$script:WorkDir       = (Get-Location).Path

# ─── Colors & Printing ───
function Write-C($text, $color="White") { Write-Host $text -ForegroundColor $color }
function Write-Header($text) {
    Write-Host ""
    Write-Host "  ═══ $text ═══" -ForegroundColor Cyan
}
function Write-Line($text) { Write-Host "  $text" }

# ─── Help ───
function Show-Help {
    Write-Header "AI Agent Commands"
    Write-Host ""
    $cmds = @(
        @{k="/write";       d="Write last AI code to file(s)";            a="[test]"}
        @{k="/test";        d="Syntax-check a file (or last written)";    a="[file]"}
        @{k="/run";         d="Run a file";                               a="<file>"}
        @{k="/fix";         d="AI reads & fixes broken code";            a="<file> [instruction]"}
        @{k="/files";       d="Show pending code files";                  a=""}
        @{k="/history";     d="Show conversation history";                a=""}
        @{k="/clear";       d="Clear conversation history";               a=""}
        @{k="/mode";        d="Toggle agent/basic mode";                  a=""}
        @{k="/help";        d="Show this help";                           a=""}
        @{k="exit";         d="Quit";                                     a=""}
    )
    foreach ($c in $cmds) {
        $key = $c.k.PadRight(14)
        $args_text = if ($c.a) { " $($c.a)" } else { "" }
        Write-Host "  " -NoNewline
        Write-Host $key -NoNewline -ForegroundColor Cyan
        Write-Host "$($c.d)$args_text"
    }
    Write-Host ""
    $modeLabel = if ($script:AgentMode) { "agent (structured)" } else { "basic (plain)" }
    Write-C "  Current mode: $modeLabel" DarkGray
    Write-Host ""
}

# ─── Code Block Printer ───
function Show-CodeBlock($filepath, $code) {
    $ext = [System.IO.Path]::GetExtension($filepath) -replace '^\.',''
    if (-not $ext) { $ext = "txt" }
    Write-C "  --- $filepath [$ext] ---" DarkYellow
    $lines = $code -split "`n"
    $max = 25
    $show = $lines | Select-Object -First $max
    $i = 1
    foreach ($line in $show) {
        $num = $i.ToString().PadLeft(3)
        Write-Host "    $num | $line"
        $i++
    }
    if ($lines.Count -gt $max) {
        Write-C "    ... ($($lines.Count - $max) more lines)" DarkGray
    }
    Write-C "  ---" DarkYellow
}

# ─── Parse AI Response (strip markdown fences) ───
function Parse-AIResponse($rawText) {
    $cleaned = $rawText.Trim()
    if ($cleaned.StartsWith('```json')) { $cleaned = $cleaned.Substring(7) }
    elseif ($cleaned.StartsWith('```'))  { $cleaned = $cleaned.Substring(3) }
    if ($cleaned.EndsWith('```'))        { $cleaned = $cleaned.Substring(0, $cleaned.Length - 3) }
    try {
        return ($cleaned.Trim() | ConvertFrom-Json)
    } catch {
        return $null
    }
}

# ─── Send Agent Query (/agent endpoint) ───
function Send-AgentQuery($prompt) {
    Write-C "  thinking..." DarkGray

    $historyPayload = @()
    foreach ($msg in $script:History) {
        $historyPayload += @{ role = $msg.role; text = $msg.text }
    }

    $body = @{
        prompt  = $prompt
        history = $historyPayload
    } | ConvertTo-Json -Depth 5

    try {
        $res = Invoke-RestMethod -Uri "$($script:ServerUrl)/agent" -Method Post `
            -Headers @{'Content-Type'='application/json'} -Body $body -TimeoutSec 120
    } catch {
        Write-C "`n  [x] Connection error: $($_.Exception.Message)`n" Red
        return
    }

    # Add to history
    [void]$script:History.Add(@{ role = "user"; text = $prompt })

    if ($res.structured -and $res.data) {
        $ai = $res.data

        if ($ai.type -eq "code_response" -and $ai.files) {
            $script:LastCode = $ai

            if ($ai.explanation) {
                Write-Host ""
                Write-C "  AI: $($ai.explanation)" Green
            }

            Write-Host ""
            Write-C "  $($ai.files.Count) file(s) ready to write:" Yellow
            Write-Host ""

            foreach ($f in $ai.files) {
                if ($f.description) {
                    Write-C "    > $($f.filepath) - $($f.description)" DarkCyan
                }
                Show-CodeBlock $f.filepath $f.code
                Write-Host ""
            }

            $fileList = ($ai.files | ForEach-Object { $_.filepath }) -join ", "
            [void]$script:History.Add(@{
                role = "model"
                text = "[Code: $fileList] $($ai.explanation)"
            })

            Write-C '  Type "/write" to save, "/write test" to save & test.' Cyan
            Write-Host ""

        } elseif ($ai.type -eq "chat_response") {
            Write-Host ""
            Write-Host "  AI: $($ai.message)" 
            Write-Host ""
            [void]$script:History.Add(@{ role = "model"; text = $ai.message })
            $script:LastCode = $null

        } else {
            $text = if ($res.raw) { $res.raw } else { $ai | ConvertTo-Json -Depth 3 }
            Write-Host ""
            Write-Host "  AI: $text"
            Write-Host ""
            [void]$script:History.Add(@{ role = "model"; text = $text })
        }

    } elseif ($res.answer) {
        Write-Host ""
        Write-Host "  AI: $($res.answer)"
        Write-Host ""
        [void]$script:History.Add(@{ role = "model"; text = $res.answer })
    } else {
        Write-C "  [x] Unexpected response from server." Red
    }

    # Trim history if too long (keep last 20 exchanges)
    while ($script:History.Count -gt 40) {
        $script:History.RemoveAt(0)
    }
}

# ─── Send Basic Query (/chat endpoint) ───
function Send-BasicQuery($prompt) {
    Write-C "  thinking..." DarkGray
    $body = @{ prompt = $prompt } | ConvertTo-Json
    try {
        $res = Invoke-RestMethod -Uri "$($script:ServerUrl)/chat" -Method Post `
            -Headers @{'Content-Type'='application/json'} -Body $body -TimeoutSec 120
        Write-Host ""
        Write-Host "  AI: $($res.answer)"
        Write-Host ""
    } catch {
        Write-C "`n  [x] Connection error: $($_.Exception.Message)`n" Red
    }
}

# ─── /write [test] ───
function Write-Files($autoTest = $false) {
    if (-not $script:LastCode -or -not $script:LastCode.files -or $script:LastCode.files.Count -eq 0) {
        Write-C "`n  No code files pending. Ask the AI to write some code first.`n" Yellow
        return
    }

    $files = $script:LastCode.files
    Write-Host ""
    Write-C "  Files to write:" Yellow
    $i = 1
    foreach ($f in $files) {
        $fullPath = Join-Path $script:WorkDir $f.filepath
        $status = if (Test-Path $fullPath) { "overwrite" } else { "create" }
        Write-Host "    $i. $($f.filepath) [$status]"
        $i++
    }
    Write-Host ""

    $targetLabel = if ($files.Count -eq 1) { $files[0].filepath } else { "$($files.Count) file(s)" }
    $answer = Read-Host "  Write to $($targetLabel)? (y/n) [y]"
    $answer = $answer.Trim().ToLower()
    if ($answer -eq "n" -or $answer -eq "no") {
        Write-C "  Cancelled.`n" DarkGray
        return
    }

    $writtenPaths = @()
    foreach ($f in $files) {
        try {
            $fullPath = Join-Path $script:WorkDir $f.filepath
            $dir = [System.IO.Path]::GetDirectoryName($fullPath)
            if (-not (Test-Path $dir)) {
                New-Item -Path $dir -ItemType Directory -Force | Out-Null
            }
            Set-Content -Path $fullPath -Value $f.code -Encoding UTF8 -NoNewline
            Write-C "    [ok] written: $($f.filepath)" Green
            $writtenPaths += $f.filepath
        } catch {
            Write-C "    [x] failed: $($f.filepath) - $($_.Exception.Message)" Red
        }
    }
    Write-Host ""

    $script:LastWritten = $writtenPaths
    $script:LastCode = $null

    if ($autoTest -and $writtenPaths.Count -gt 0) {
        Test-Files $writtenPaths
    }
}

# ─── /test [file] ───
function Test-Files($filePaths) {
    Write-C "`n  Testing $($filePaths.Count) file(s)...`n" DarkGray
    foreach ($fp in $filePaths) {
        $fullPath = Join-Path $script:WorkDir $fp
        if (-not (Test-Path $fullPath)) {
            Write-C "    [x] not found: $fp" Red
            continue
        }
        $ext = [System.IO.Path]::GetExtension($fp).ToLower()
        $cmd = switch ($ext) {
            ".js"   { "node -c `"$fullPath`"" }
            ".mjs"  { "node -c `"$fullPath`"" }
            ".ts"   { "npx tsc --noEmit `"$fullPath`"" }
            ".py"   { "python -c `"import py_compile; py_compile.compile('$fullPath', doraise=True)`"" }
            ".json" { "node -e `"JSON.parse(require('fs').readFileSync('$fullPath','utf8'))`"" }
            ".sh"   { "bash -n `"$fullPath`"" }
            default { $null }
        }
        if (-not $cmd) {
            Write-C "    [-] skip: $fp (no checker for $ext)" DarkGray
            continue
        }
        try {
            $output = cmd /c $cmd 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-C "    [ok] syntax ok: $fp" Green
            } else {
                Write-C "    [x] syntax error: $fp" Red
                $output | Select-Object -First 5 | ForEach-Object { Write-Host "         $_" }
            }
        } catch {
            Write-C "    [x] error: $fp - $($_.Exception.Message)" Red
        }
    }
    Write-Host ""
}

# ─── /run <file> ───
function Run-File($filepath) {
    $fullPath = Join-Path $script:WorkDir $filepath
    if (-not (Test-Path $fullPath)) {
        Write-C "`n  File not found: $filepath`n" Red
        return
    }
    $ext = [System.IO.Path]::GetExtension($filepath).ToLower()
    $cmd = switch ($ext) {
        ".js"   { "node `"$fullPath`"" }
        ".mjs"  { "node `"$fullPath`"" }
        ".ts"   { "npx tsx `"$fullPath`"" }
        ".py"   { "python `"$fullPath`"" }
        ".ps1"  { "powershell -File `"$fullPath`"" }
        ".sh"   { "bash `"$fullPath`"" }
        ".bat"  { "`"$fullPath`"" }
        default { $null }
    }
    if (-not $cmd) {
        Write-C "`n  No runner for $ext files.`n" Yellow
        return
    }
    Write-C "`n  Running $filepath..." DarkGray
    Write-Host ""
    try {
        cmd /c $cmd 2>&1 | ForEach-Object { Write-Host "  $_" }
        if ($LASTEXITCODE -eq 0) {
            Write-C "`n  Exited OK.`n" Green
        } else {
            Write-C "`n  Exited with code $LASTEXITCODE.`n" Yellow
        }
    } catch {
        Write-C "`n  Runtime error: $($_.Exception.Message)`n" Red
    }
}

# ─── /fix <file> [instruction] ───
function Fix-File($argStr) {
    $parts = $argStr -split '\s+', 2
    $filepath = $parts[0]
    $instruction = if ($parts.Count -gt 1) { $parts[1] } else { $null }

    $fullPath = Join-Path $script:WorkDir $filepath
    if (-not (Test-Path $fullPath)) {
        Write-C "`n  File not found: $filepath`n" Red
        return
    }

    $code = Get-Content -Path $fullPath -Raw
    $lineCount = ($code -split "`n").Count
    Write-C "`n  Reading $filepath ($lineCount lines)" DarkGray
    Write-C "  Sending to AI for analysis..." DarkGray
    Write-Host ""

    $body = @{
        filepath    = $filepath
        code        = $code
        instruction = $instruction
    } | ConvertTo-Json -Depth 3

    try {
        $res = Invoke-RestMethod -Uri "$($script:ServerUrl)/fix" -Method Post `
            -Headers @{'Content-Type'='application/json'} -Body $body -TimeoutSec 120
    } catch {
        Write-C "  [x] Connection error: $($_.Exception.Message)`n" Red
        return
    }

    if ($res.structured -and $res.data -and $res.data.type -eq "fix_response") {
        $fix = $res.data

        if ($fix.issues_found -and $fix.issues_found.Count -gt 0) {
            Write-C "  $($fix.issues_found.Count) issue(s) found:" Yellow
            Write-Host ""
            foreach ($issue in $fix.issues_found) {
                $line = if ($issue.line) { $issue.line } else { "?" }
                Write-C "    Line $($line): $($issue.problem)" Red
                Write-C "      Fix: $($issue.fix)" Green
                Write-Host ""
            }
        }

        if ($fix.summary) {
            Write-C "  Summary: $($fix.summary)" Cyan
            Write-Host ""
        }

        if ($fix.fixed_code) {
            Show-CodeBlock $filepath $fix.fixed_code

            $script:LastCode = @{
                type  = "code_response"
                files = @(@{
                    filepath    = $filepath
                    description = if ($fix.summary) { $fix.summary } else { "Fixed code" }
                    code        = $fix.fixed_code
                })
                explanation = $fix.summary
            }

            Write-Host ""
            Write-Files $false
        }
    } else {
        $msg = if ($res.data.message) { $res.data.message } elseif ($res.raw) { $res.raw } else { "No response" }
        Write-Host "  AI: $msg`n"
    }
}

# ─── /files ───
function Show-PendingFiles {
    if (-not $script:LastCode -or -not $script:LastCode.files) {
        Write-C "`n  No code files pending.`n" Yellow
        return
    }
    Write-C "`n  Pending files:" Yellow
    $i = 1
    foreach ($f in $script:LastCode.files) {
        $desc = if ($f.description) { " - $($f.description)" } else { "" }
        Write-Host "    $i. $($f.filepath)$desc"
        $i++
    }
    Write-C "`n  Type /write to save them.`n" Cyan
}

# ─── /history ───
function Show-History {
    if ($script:History.Count -eq 0) {
        Write-C "`n  No conversation history yet.`n" Yellow
        return
    }
    Write-C "`n  Conversation history:" Cyan
    $i = 1
    foreach ($msg in $script:History) {
        $who = if ($msg.role -eq "user") { "You" } else { "AI " }
        $preview = $msg.text
        if ($preview.Length -gt 80) { $preview = $preview.Substring(0, 80) + "..." }
        Write-Host "    $i. $($who): $preview"
        $i++
    }
    Write-Host ""
}

# ═══════════════════════════════════════════════════════════════
#  MAIN: Connect & Start Interactive Loop
# ═══════════════════════════════════════════════════════════════

$script:ServerUrl = Get-ServerUrl

Write-Host ""
Write-Host "  +------------------------------------------+" -ForegroundColor Cyan
Write-Host "  |  AI Agent Ready (Remote Client)          |" -ForegroundColor Cyan
Write-Host "  |  Type /help for available commands       |" -ForegroundColor Cyan
Write-Host "  +------------------------------------------+" -ForegroundColor Cyan
Write-Host "  [connected: $($script:ServerUrl)]" -ForegroundColor DarkGray
Write-Host ""

while ($true) {
    $modeTag = if ($script:AgentMode) { "agent" } else { "basic" }
    $input_text = Read-Host "You [$modeTag]"
    $trimmed = $input_text.Trim()

    if (-not $trimmed) { continue }

    # ─── exit ───
    if ($trimmed -eq "exit") {
        Write-C "`n  Goodbye.`n" Cyan
        break
    }

    # ─── /help ───
    if ($trimmed -eq "/help") { Show-Help; continue }

    # ─── /mode ───
    if ($trimmed -eq "/mode") {
        $script:AgentMode = -not $script:AgentMode
        $label = if ($script:AgentMode) { "agent (structured)" } else { "basic (plain)" }
        Write-C "`n  Switched to $label mode.`n" Green
        continue
    }

    # ─── /clear ───
    if ($trimmed -eq "/clear") {
        $script:History.Clear()
        $script:LastCode = $null
        $script:LastWritten = @()
        Write-C "`n  Conversation cleared.`n" Green
        continue
    }

    # ─── /history ───
    if ($trimmed -eq "/history") { Show-History; continue }

    # ─── /files ───
    if ($trimmed -eq "/files") { Show-PendingFiles; continue }

    # ─── /write [test] ───
    if ($trimmed -eq "/write" -or $trimmed -eq "/write test") {
        $autoTest = ($trimmed -eq "/write test")
        Write-Files $autoTest
        continue
    }

    # ─── /test [file] ───
    if ($trimmed -match "^/test") {
        $arg = ($trimmed -replace "^/test\s*","").Trim()
        if ($arg) {
            Test-Files @($arg)
        } elseif ($script:LastWritten.Count -gt 0) {
            Test-Files $script:LastWritten
        } else {
            Write-C "`n  No files to test. Use: /test myfile.js`n" Yellow
        }
        continue
    }

    # ─── /run <file> ───
    if ($trimmed -match "^/run") {
        $arg = ($trimmed -replace "^/run\s*","").Trim()
        if ($arg) {
            Run-File $arg
        } else {
            Write-C "`n  Usage: /run <filepath>`n" Yellow
        }
        continue
    }

    # ─── /fix <file> [instruction] ───
    if ($trimmed -match "^/fix") {
        $arg = ($trimmed -replace "^/fix\s*","").Trim()
        if ($arg) {
            Fix-File $arg
        } else {
            Write-C "`n  Usage: /fix <file> [instruction]" Yellow
            Write-C "    Example: /fix server.js" DarkGray
            Write-C "    Example: /fix app.py add error handling`n" DarkGray
        }
        continue
    }

    # ─── Normal prompt → send to AI ───
    if ($script:AgentMode) {
        Send-AgentQuery $trimmed
    } else {
        Send-BasicQuery $trimmed
    }
}
