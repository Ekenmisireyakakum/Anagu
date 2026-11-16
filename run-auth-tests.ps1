$env:DATABASE_URL = "postgresql://anagu:anagu_password@localhost:5432/anagu_db"
Set-Location "C:\Users\StarLab\Desktop\Library\Anagu"
node ".\node_modules\jest\bin\jest.js" --config="jest.api.config.js" --testPathPattern="auth.service.spec" --testTimeout=30000 --forceExit --no-coverage
Write-Output "JEST_EXIT:$LASTEXITCODE"
