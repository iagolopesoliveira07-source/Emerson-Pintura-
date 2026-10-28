@echo off
setlocal
chcp 65001 >nul
title Emerson Pinturas — Sistema de Gestão
cd /d "%~dp0"

echo.
echo  Emerson Pinturas — Sistema de Gestão
echo  ------------------------------------
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  Node.js nao foi encontrado neste computador.
  echo  Instale a versao LTS em https://nodejs.org e volte a executar este ficheiro.
  echo.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo  Este ficheiro tem de ficar na pasta do projeto emerson-pinturas.
  echo.
  pause
  exit /b 1
)

netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo  O sistema ja esta a correr.
  echo  A abrir http://localhost:5173/
  start "" "http://localhost:5173/"
  echo.
  timeout /t 3 /nobreak >nul
  exit /b 0
)

if not exist "node_modules\" (
  echo  A instalar dependencias pela primeira vez. Isto pode demorar alguns minutos...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  Nao foi possivel instalar as dependencias.
    pause
    exit /b 1
  )
  echo.
)

echo  A gerar a versao de producao e a iniciar em http://localhost:5173/
echo  Nao feche esta janela enquanto estiver a usar o sistema.
echo  Para parar, feche esta janela ou prima Ctrl+C.
echo.

call npm run prod
if errorlevel 1 (
  echo.
  echo  Nao foi possivel iniciar o sistema.
  pause
  exit /b 1
)

endlocal
