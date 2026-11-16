$need = @("jest","ts-jest","typescript","pg","reflect-metadata","class-transformer","resolve","@nestjs/common","@nestjs/core","class-validator","@types/jest","@types/pg","@types/node","rxjs")
foreach ($p in $need) {
    $ok = Test-Path "C:\Users\StarLab\Desktop\Library\Anagu\node_modules\$p\package.json"
    $status = if ($ok) { "OK" } else { "BROKEN" }
    Write-Output "$p $status"
}
