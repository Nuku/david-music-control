$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$releaseRoot = $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $releaseRoot 'module.json') -Raw | ConvertFrom-Json
$canonicalPath = Join-Path $releaseRoot "$($manifest.id).zip"
$releaseFiles = @('module.json', 'main.js', 'main.css', 'README.md', 'CHANGELOG.md')
foreach ($directory in @('module', 'styles', 'templates')) {
    $releaseFiles += Get-ChildItem -LiteralPath (Join-Path $releaseRoot $directory) -Recurse -File |
        ForEach-Object { [IO.Path]::GetRelativePath($releaseRoot, $_.FullName) }
}

$stream = [IO.File]::Open($canonicalPath, [IO.FileMode]::Create)
$archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $releaseFiles) {
        $entryName = $file.Replace('\', '/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive, (Join-Path $releaseRoot $file), $entryName,
            [IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
} finally {
    $archive.Dispose()
    $stream.Dispose()
}

$archive = [IO.Compression.ZipFile]::OpenRead($canonicalPath)
try {
    foreach ($file in $releaseFiles) {
        $entry = $archive.GetEntry($file.Replace('\', '/'))
        if (!$entry) { throw "Release archive is missing $file" }
        $entryStream = $entry.Open()
        $localStream = [IO.File]::OpenRead((Join-Path $releaseRoot $file))
        $hash = [Security.Cryptography.SHA256]::Create()
        try {
            $packedHash = [Convert]::ToHexString($hash.ComputeHash($entryStream))
            $localHash = [Convert]::ToHexString($hash.ComputeHash($localStream))
            if ($packedHash -ne $localHash) { throw "Release archive differs from $file" }
        } finally {
            $hash.Dispose()
            $entryStream.Dispose()
            $localStream.Dispose()
        }
    }
    Write-Output "Verified $($archive.Entries.Count) release files for v$($manifest.version)."
} finally {
    $archive.Dispose()
}
Write-Output "Created $canonicalPath."
