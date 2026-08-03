# ============================================================
#  serve.ps1  --  Local Development Server
#  Delta Force Cheat Website
#  Usage:  .\serve.ps1
#          .\serve.ps1 -Port 3000
#          .\serve.ps1 -Port 8080 -NoOpen
# ============================================================

param(
    [int]$Port   = 5500,
    [switch]$NoOpen
)

$RootDir = $PSScriptRoot

# ── MIME TYPE MAP ────────────────────────────────────────────
$MimeTypes = @{
    '.html'  = 'text/html; charset=utf-8'
    '.css'   = 'text/css; charset=utf-8'
    '.js'    = 'application/javascript; charset=utf-8'
    '.json'  = 'application/json; charset=utf-8'
    '.webp'  = 'image/webp'
    '.png'   = 'image/png'
    '.jpg'   = 'image/jpeg'
    '.jpeg'  = 'image/jpeg'
    '.gif'   = 'image/gif'
    '.svg'   = 'image/svg+xml'
    '.ico'   = 'image/x-icon'
    '.woff'  = 'font/woff'
    '.woff2' = 'font/woff2'
    '.ttf'   = 'font/ttf'
    '.otf'   = 'font/otf'
    '.mp4'   = 'video/mp4'
    '.webm'  = 'video/webm'
    '.ogg'   = 'video/ogg'
    '.txt'   = 'text/plain; charset=utf-8'
    '.xml'   = 'application/xml'
    '.pdf'   = 'application/pdf'
    '.map'   = 'application/json'
}

# ── HELPER: Get MIME type for a file extension ───────────────
function Get-MimeType([string]$ext) {
    if ($MimeTypes.ContainsKey($ext)) { return $MimeTypes[$ext] }
    return 'application/octet-stream'
}

# ── HELPER: Resolve URL path to filesystem path ───────────────
function Resolve-RequestPath([string]$rawUrl) {
    $path = $rawUrl.Split('?')[0]
    $path = [System.Uri]::UnescapeDataString($path)
    if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }
    $relative = $path.TrimStart('/')
    return (Join-Path $RootDir $relative)
}

# ── CHECK IF PORT IS FREE ────────────────────────────────────
function Test-PortFree([int]$p) {
    $props     = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties()
    $listeners = $props.GetActiveTcpListeners()
    return -not ($listeners | Where-Object { $_.Port -eq $p })
}

if (-not (Test-PortFree $Port)) {
    Write-Host ""
    Write-Host "  [!] Port $Port is already in use. Trying $($Port + 1)..." -ForegroundColor Yellow
    $Port++
    if (-not (Test-PortFree $Port)) {
        Write-Host "  [X] Port $Port is also busy. Use -Port <number> to specify another." -ForegroundColor Red
        exit 1
    }
}

# ── START HTTP LISTENER ──────────────────────────────────────
$BaseUrl  = "http://localhost:$Port/"
$Listener = [System.Net.HttpListener]::new()
$Listener.Prefixes.Add($BaseUrl)

try {
    $Listener.Start()
} catch {
    Write-Host ""
    Write-Host "  [X] Could not start server on port $Port." -ForegroundColor Red
    Write-Host "      $_" -ForegroundColor DarkGray
    Write-Host "      Try running as Administrator or choose a different port (-Port 8080)." -ForegroundColor DarkGray
    exit 1
}

# ── WELCOME BANNER ───────────────────────────────────────────
Clear-Host
Write-Host ""
Write-Host "  +------------------------------------------+" -ForegroundColor Magenta
Write-Host "  |  DELTA FORCE WEBSITE -- DEV SERVER       |" -ForegroundColor Magenta
Write-Host "  +------------------------------------------+" -ForegroundColor Magenta
Write-Host ""
Write-Host "  [>>] Local:  " -NoNewline -ForegroundColor Green
Write-Host $BaseUrl
Write-Host "  [>>] Root:   " -NoNewline -ForegroundColor DarkGray
Write-Host $RootDir
Write-Host "  [>>] Pages:  index.html  delta-force-cheats.html  blog.html  guide.html" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Press Ctrl+C to stop the server." -ForegroundColor Yellow
Write-Host ""
Write-Host "  ------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# ── OPEN BROWSER ─────────────────────────────────────────────
if (-not $NoOpen) {
    Start-Sleep -Milliseconds 300
    Start-Process $BaseUrl
    Write-Host "  [>>] Browser launched at $BaseUrl" -ForegroundColor Cyan
    Write-Host ""
}

# ── MAIN SERVE LOOP ──────────────────────────────────────────
$requestCount = 0

try {
    while ($Listener.IsListening) {

        $contextTask = $Listener.GetContextAsync()

        # Poll every 200 ms so Ctrl+C is responsive
        while (-not $contextTask.IsCompleted) {
            Start-Sleep -Milliseconds 200
        }

        if ($contextTask.IsFaulted) { continue }

        $ctx  = $contextTask.Result
        $req  = $ctx.Request
        $resp = $ctx.Response

        $requestCount++
        $filePath = Resolve-RequestPath $req.RawUrl
        $ext      = [System.IO.Path]::GetExtension($filePath).ToLower()

        try {
            if ([System.IO.File]::Exists($filePath)) {

                $mime  = Get-MimeType $ext
                $fileInfo = [System.IO.FileInfo]::new($filePath)
                $fileSize = $fileInfo.Length

                if ($ext -eq '.html') {
                    $resp.Headers.Add('Cache-Control', 'no-cache')
                } else {
                    $resp.Headers.Add('Cache-Control', 'public, max-age=3600')
                }

                # Support Range requests (crucial for video streaming without blocking)
                $resp.Headers.Add('Accept-Ranges', 'bytes')

                $start = 0
                $end = $fileSize - 1
                $isRange = $false

                $rangeHeader = $req.Headers['Range']
                if ($rangeHeader -match 'bytes=(\d+)-(\d*)') {
                    $isRange = $true
                    $start = [long]$matches[1]
                    if ($matches.Count -gt 2 -and -not [string]::IsNullOrEmpty($matches[2])) {
                        $end = [long]$matches[2]
                    }
                    if ($end -ge $fileSize) {
                        $end = $fileSize - 1
                    }
                }

                $contentLength = ($end - $start) + 1

                if ($isRange) {
                    $resp.StatusCode = 206
                    $resp.Headers.Add('Content-Range', "bytes $($start)-$($end)/$($fileSize)")
                } else {
                    $resp.StatusCode = 200
                }

                $resp.ContentType     = $mime
                $resp.ContentLength64 = $contentLength

                # Stream the file in chunks rather than reading all bytes into memory
                $fs = [System.IO.File]::OpenRead($filePath)
                if ($start -gt 0) {
                    $null = $fs.Seek($start, [System.IO.SeekOrigin]::Begin)
                }

                $buffer = New-Object byte[] 65536
                $remaining = $contentLength

                try {
                    while ($remaining -gt 0) {
                        $toRead = [Math]::Min($remaining, $buffer.Length)
                        $read = $fs.Read($buffer, 0, $toRead)
                        if ($read -eq 0) { break }
                        $resp.OutputStream.Write($buffer, 0, $read)
                        $remaining -= $read
                    }
                } catch {
                    # Browser disconnected or aborted range request (normal for videos)
                    # Silently catch to prevent 500 error spam in the console
                } finally {
                    $fs.Close()
                }

                $logColor = if ($ext -eq '.html')              { 'Green' }
                            elseif ($ext -in @('.css', '.js')) { 'Cyan'  }
                            elseif ($ext -eq '.mp4')           { 'Magenta' }
                            else                               { 'DarkGray' }

                $shortUrl = $req.RawUrl.Split('?')[0]
                $statusLog = if ($isRange) { "206" } else { "200" }
                
                # Only log non-range requests or the very first chunk of a video to keep console clean
                if (-not $isRange -or $start -eq 0) {
                    Write-Host "  $statusLog  " -NoNewline -ForegroundColor $logColor
                    Write-Host $shortUrl
                }

            } else {

                $body  = "<html><head><title>404</title><style>body{font-family:sans-serif;background:#0B0914;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px}h1{color:#A855F7}a{color:#A855F7}</style></head><body><h1>404</h1><p>$([System.Net.WebUtility]::HtmlEncode($req.RawUrl)) not found.</p><a href='/'>Back to Home</a></body></html>"
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)

                $resp.StatusCode      = 404
                $resp.ContentType     = 'text/html; charset=utf-8'
                $resp.ContentLength64 = $bytes.Length
                $resp.OutputStream.Write($bytes, 0, $bytes.Length)

                Write-Host "  404  " -NoNewline -ForegroundColor Yellow
                Write-Host $req.RawUrl -ForegroundColor DarkGray
            }

        } catch {
            try {
                $errBody = "<html><body><h1>500 Server Error</h1><pre>$([System.Net.WebUtility]::HtmlEncode($_.ToString()))</pre></body></html>"
                $bytes   = [System.Text.Encoding]::UTF8.GetBytes($errBody)
                $resp.StatusCode      = 500
                $resp.ContentType     = 'text/html; charset=utf-8'
                $resp.ContentLength64 = $bytes.Length
                $resp.OutputStream.Write($bytes, 0, $bytes.Length)
            } catch { }

            Write-Host "  500  " -NoNewline -ForegroundColor Red
            Write-Host "$($req.RawUrl)  --  $_" -ForegroundColor DarkGray

        } finally {
            try { $resp.OutputStream.Close() } catch { }
        }
    }

} finally {
    $Listener.Stop()
    $Listener.Close()
    Write-Host ""
    Write-Host "  [STOPPED]  Server shut down. Served $requestCount request(s)." -ForegroundColor DarkGray
    Write-Host ""
}
