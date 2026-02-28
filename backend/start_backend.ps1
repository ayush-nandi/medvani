$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$python = Join-Path $root '.venv\Scripts\python.exe'
if (!(Test-Path $python)) {
  throw "Python venv not found at $python"
}

Set-Location $PSScriptRoot
& $python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
