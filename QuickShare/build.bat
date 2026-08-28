@echo off
chcp 65001 >nul
echo ========================================
echo   QuickShare 打包脚本
echo ========================================
echo.

:: 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.8+
    pause
    exit /b 1
)

:: 安装依赖
echo [1/3] 安装依赖...
pip install -r requirements.txt -q
if errorlevel 1 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)

:: 打包
echo [2/3] 正在打包 exe（可能需要几分钟）...
pyinstaller --noconfirm --onefile --windowed ^
    --name QuickShare ^
    --icon=NONE ^
    --add-data "config.py;." ^
    --hidden-import=customtkinter ^
    --hidden-import=PIL ^
    --hidden-import=PIL._tkinter_finder ^
    main.py

if errorlevel 1 (
    echo [错误] 打包失败
    pause
    exit /b 1
)

echo.
echo [3/3] 打包完成！
echo.
echo 可执行文件位置: dist\QuickShare.exe
echo.
echo 使用方法:
echo   1. 将 QuickShare.exe 复制给你和同事
echo   2. 确保大家在同一局域网/WiFi 下
echo   3. 双方同时运行，即可互相发现和传文件
echo.
pause
