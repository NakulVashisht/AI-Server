# AI-Server Remote Agent Client (PowerShell)
# Usage: irm <your-hosted-url> | iex

# ─── Resolve Server URL ───
function Get-ServerUrl {
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:3000/chat" -Method Post `
            -Headers @{'Content-Type'='application/json'} `
            -Body (@{prompt="ping"}|ConvertTo-Json) -TimeoutSec 2 -ErrorAction Stop
        return "http://127.0.0.1:3000"
    } catch {}
    try {
        $raw = (Invoke-RestMethod -Uri "https://ntfy.sh/ghosty001_ai_tunnel_sync/raw?poll=1" -TimeoutSec 5)
        $lines = ($raw -split "`n") | Where-Object { $_.Trim() -match "^https?://" }
        if ($lines.Count -gt 0) { return ($lines[-1]).Trim() }
    } catch {}
    Write-Host "could not connect to server."; exit 1
}

$script:ServerUrl   = ""
$script:AgentMode   = $true
$script:History     = [System.Collections.ArrayList]::new()
$script:LastCode    = $null
$script:LastWritten = @()
$script:WorkDir     = (Get-Location).Path

# ─── Help ───
function Show-Help {
    Write-Host ""
    Write-Host "commands:"
    Write-Host "  /write         write last AI code to file(s) [test]"
    Write-Host "  /test          syntax-check a file (or last written) [file]"
    Write-Host "  /run           run a file <file>"
    Write-Host "  /fix           AI reads & fixes broken code <file> [instruction]"
    Write-Host "  /files         show pending code files"
    Write-Host "  /history       show conversation history"
    Write-Host "  /clear         clear conversation history"
    Write-Host "  /mode          toggle agent/basic mode"
    Write-Host "  /help          show this help"
    Write-Host "  exit           quit"
    $modeLabel = if ($script:AgentMode) { "agent" } else { "basic" }
    Write-Host "  mode: $modeLabel"
    Write-Host ""
}

# ─── Code Block ───
function Show-CodeBlock($filepath, $code) {
    $ext = [System.IO.Path]::GetExtension($filepath) -replace '^\.',''
    if (-not $ext) { $ext = "txt" }
    Write-Host "--- $filepath [$ext] ---"
    $lines = $code -split "`n"
    $max = 25
    $show = $lines | Select-Object -First $max
    $i = 1
    foreach ($line in $show) {
        $num = $i.ToString().PadLeft(3)
        Write-Host "  $num | $line"
        $i++
    }
    if ($lines.Count -gt $max) { Write-Host "  ... ($($lines.Count - $max) more lines)" }
    Write-Host "---"
}

# ─── Send Agent Query ───
function Send-AgentQuery($prompt) {

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
        Write-Host "connection error: $($_.Exception.Message)"
        return
    }

    [void]$script:History.Add(@{ role = "user"; text = $prompt })

    if ($res.structured -and $res.data) {
        $ai = $res.data

        if ($ai.type -eq "code_response" -and $ai.files) {
            $script:LastCode = $ai

            if ($ai.explanation) { Write-Host "`nAI: $($ai.explanation)" }

            Write-Host "`n$($ai.files.Count) file(s) ready to write:`n"

            foreach ($f in $ai.files) {
                if ($f.description) { Write-Host "  > $($f.filepath) - $($f.description)" }
                Show-CodeBlock $f.filepath $f.code
                Write-Host ""
            }

            $fileList = ($ai.files | ForEach-Object { $_.filepath }) -join ", "
            [void]$script:History.Add(@{
                role = "model"
                text = "[Code: $fileList] $($ai.explanation)"
            })

            Write-Host 'type /write to save, /write test to save & test.'
            Write-Host ""

        } elseif ($ai.type -eq "chat_response") {
            Write-Host "`nAI: $($ai.message)`n"
            [void]$script:History.Add(@{ role = "model"; text = $ai.message })
            $script:LastCode = $null

        } else {
            $text = if ($res.raw) { $res.raw } else { $ai | ConvertTo-Json -Depth 3 }
            Write-Host "`nAI: $text`n"
            [void]$script:History.Add(@{ role = "model"; text = $text })
        }

    } elseif ($res.answer) {
        Write-Host "`nAI: $($res.answer)`n"
        [void]$script:History.Add(@{ role = "model"; text = $res.answer })
    } else {
        Write-Host "error: unexpected response from server."
    }

    while ($script:History.Count -gt 40) { $script:History.RemoveAt(0) }
}

# ─── Send Basic Query ───
function Send-BasicQuery($prompt) {
    $body = @{ prompt = $prompt } | ConvertTo-Json
    try {
        $res = Invoke-RestMethod -Uri "$($script:ServerUrl)/chat" -Method Post `
            -Headers @{'Content-Type'='application/json'} -Body $body -TimeoutSec 120
        Write-Host "`nAI: $($res.answer)`n"
    } catch {
        Write-Host "connection error: $($_.Exception.Message)"
    }
}

# ─── /write ───
function Write-Files($autoTest = $false) {
    if (-not $script:LastCode -or -not $script:LastCode.files -or $script:LastCode.files.Count -eq 0) {
        Write-Host "`nno code files pending.`n"
        return
    }

    $files = $script:LastCode.files
    Write-Host "`nfiles to write:"
    $i = 1
    foreach ($f in $files) {
        $fullPath = Join-Path $script:WorkDir $f.filepath
        $status = if (Test-Path $fullPath) { "overwrite" } else { "create" }
        Write-Host "  $i. $($f.filepath) [$status]"
        $i++
    }
    Write-Host ""

    $targetLabel = if ($files.Count -eq 1) { $files[0].filepath } else { "$($files.Count) file(s)" }
    $answer = Read-Host "write to $($targetLabel)? (y/n) [y]"
    $answer = $answer.Trim().ToLower()
    if ($answer -eq "n" -or $answer -eq "no") {
        Write-Host "cancelled.`n"
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
            Write-Host "  [ok] written: $($f.filepath)"
            $writtenPaths += $f.filepath
        } catch {
            Write-Host "  [x] failed: $($f.filepath) - $($_.Exception.Message)"
        }
    }
    Write-Host ""

    $script:LastWritten = $writtenPaths
    $script:LastCode = $null

    if ($autoTest -and $writtenPaths.Count -gt 0) { Test-Files $writtenPaths }
}

# ─── /test ───
function Test-Files($filePaths) {
    Write-Host "`ntesting $($filePaths.Count) file(s)...`n"
    foreach ($fp in $filePaths) {
        $fullPath = Join-Path $script:WorkDir $fp
        if (-not (Test-Path $fullPath)) {
            Write-Host "  [x] not found: $fp"
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
            Write-Host "  [-] skip: $fp (no checker for $ext)"
            continue
        }
        try {
            $output = cmd /c $cmd 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  [ok] syntax ok: $fp"
            } else {
                Write-Host "  [x] syntax error: $fp"
                $output | Select-Object -First 5 | ForEach-Object { Write-Host "       $_" }
            }
        } catch {
            Write-Host "  [x] error: $fp - $($_.Exception.Message)"
        }
    }
    Write-Host ""
}

# ─── /run ───
function Run-File($filepath) {
    $fullPath = Join-Path $script:WorkDir $filepath
    if (-not (Test-Path $fullPath)) {
        Write-Host "`nfile not found: $filepath`n"
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
        Write-Host "`nno runner for $ext files.`n"
        return
    }
    Write-Host "`nrunning $filepath...`n"
    try {
        cmd /c $cmd 2>&1 | ForEach-Object { Write-Host "  $_" }
        if ($LASTEXITCODE -eq 0) { Write-Host "`nexited ok.`n" }
        else { Write-Host "`nexited with code $LASTEXITCODE.`n" }
    } catch {
        Write-Host "`nruntime error: $($_.Exception.Message)`n"
    }
}

# ─── /fix ───
function Fix-File($argStr) {
    $parts = $argStr -split '\s+', 2
    $filepath = $parts[0]
    $instruction = if ($parts.Count -gt 1) { $parts[1] } else { $null }

    $fullPath = Join-Path $script:WorkDir $filepath
    if (-not (Test-Path $fullPath)) {
        Write-Host "`nfile not found: $filepath`n"
        return
    }

    $code = Get-Content -Path $fullPath -Raw
    $lineCount = ($code -split "`n").Count
    Write-Host "`nreading $filepath ($lineCount lines)"
    Write-Host "sending to AI for analysis...`n"

    $body = @{
        filepath    = $filepath
        code        = $code
        instruction = $instruction
    } | ConvertTo-Json -Depth 3

    try {
        $res = Invoke-RestMethod -Uri "$($script:ServerUrl)/fix" -Method Post `
            -Headers @{'Content-Type'='application/json'} -Body $body -TimeoutSec 120
    } catch {
        Write-Host "connection error: $($_.Exception.Message)"
        return
    }

    if ($res.structured -and $res.data -and $res.data.type -eq "fix_response") {
        $fix = $res.data

        if ($fix.issues_found -and $fix.issues_found.Count -gt 0) {
            Write-Host "$($fix.issues_found.Count) issue(s) found:`n"
            foreach ($issue in $fix.issues_found) {
                $line = if ($issue.line) { $issue.line } else { "?" }
                Write-Host "  line $($line): $($issue.problem)"
                Write-Host "    fix: $($issue.fix)"
                Write-Host ""
            }
        }

        if ($fix.summary) { Write-Host "summary: $($fix.summary)`n" }

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
        Write-Host "AI: $msg`n"
    }
}

# ─── /files ───
function Show-PendingFiles {
    if (-not $script:LastCode -or -not $script:LastCode.files) {
        Write-Host "`nno code files pending.`n"
        return
    }
    Write-Host "`npending files:"
    $i = 1
    foreach ($f in $script:LastCode.files) {
        $desc = if ($f.description) { " - $($f.description)" } else { "" }
        Write-Host "  $i. $($f.filepath)$desc"
        $i++
    }
    Write-Host "`ntype /write to save them.`n"
}

# ─── /history ───
function Show-History {
    if ($script:History.Count -eq 0) {
        Write-Host "`nno conversation history yet.`n"
        return
    }
    Write-Host "`nconversation history:"
    $i = 1
    foreach ($msg in $script:History) {
        $who = if ($msg.role -eq "user") { "You" } else { "AI " }
        $preview = $msg.text
        if ($preview.Length -gt 80) { $preview = $preview.Substring(0, 80) + "..." }
        Write-Host "  $i. $($who): $preview"
        $i++
    }
    Write-Host ""
}

# ─── MAIN ───
$script:ServerUrl = Get-ServerUrl

while ($true) {
    $modeTag = if ($script:AgentMode) { "agent" } else { "basic" }
    $input_text = Read-Host "You [$modeTag]"
    $trimmed = $input_text.Trim()

    if (-not $trimmed) { continue }

    if ($trimmed -eq "exit") { break }

    if ($trimmed -eq "/help") { Show-Help; continue }

    if ($trimmed -eq "/mode") {
        $script:AgentMode = -not $script:AgentMode
        $label = if ($script:AgentMode) { "agent" } else { "basic" }
        Write-Host "switched to $label mode.`n"
        continue
    }

    if ($trimmed -eq "/clear") {
        $script:History.Clear()
        $script:LastCode = $null
        $script:LastWritten = @()
        Write-Host "conversation cleared.`n"
        continue
    }

    if ($trimmed -eq "/history") { Show-History; continue }
    if ($trimmed -eq "/files") { Show-PendingFiles; continue }

    if ($trimmed -eq "/write" -or $trimmed -eq "/write test") {
        $autoTest = ($trimmed -eq "/write test")
        Write-Files $autoTest
        continue
    }

    if ($trimmed -match "^/test") {
        $arg = ($trimmed -replace "^/test\s*","").Trim()
        if ($arg) { Test-Files @($arg) }
        elseif ($script:LastWritten.Count -gt 0) { Test-Files $script:LastWritten }
        else { Write-Host "`nno files to test. use: /test myfile.js`n" }
        continue
    }

    if ($trimmed -match "^/run") {
        $arg = ($trimmed -replace "^/run\s*","").Trim()
        if ($arg) { Run-File $arg }
        else { Write-Host "`nusage: /run <filepath>`n" }
        continue
    }

    if ($trimmed -match "^/fix") {
        $arg = ($trimmed -replace "^/fix\s*","").Trim()
        if ($arg) { Fix-File $arg }
        else {
            Write-Host "`nusage: /fix <file> [instruction]"
            Write-Host "  example: /fix server.js"
            Write-Host "  example: /fix app.py add error handling`n"
        }
        continue
    }

    if ($script:AgentMode) { Send-AgentQuery $trimmed }
    else { Send-BasicQuery $trimmed }
}
