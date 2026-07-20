@echo off
set "PATH=C:\Users\migue\AppData\Local\Logi\LogiPluginService\PluginHosts\node22\node;%PATH%"
cd /d "%~dp0"
echo A arrancar a app de gestao do patrimonio em http://localhost:3000
npm run dev
