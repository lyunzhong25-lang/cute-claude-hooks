#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Code 汉化工具 - 改进版
使用 Python 进行文本替换，支持更可靠的特殊字符处理
"""

import os
import sys
import shutil

# ========== 颜色定义 (跨平台兼容) ==========
import platform

# Windows 需要启用 ANSI 支持
if platform.system() == 'Windows':
    import ctypes
    kernel32 = ctypes.windll.kernel32
    kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)

RED = '\033[91m'      # Windows 兼容红色
GREEN = '\033[92m'    # Windows 兼容绿色
YELLOW = '\033[93m'   # Windows 兼容黄色
MAGENTA = '\033[95m'  # Windows 兼容粉色
NC = '\033[0m'        # 无颜色

# ========== 获取脚本目录 ==========
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# ========== 获取 CLI 路径 (Windows 优化) ==========
def get_cli_paths():
    """获取 Claude Code CLI 路径"""

    # Windows: 使用环境变量获取 AppData 路径
    if platform.system() == 'Windows':
        appdata = os.environ.get('APPDATA', '')
        if appdata:
            npm_modules = os.path.join(appdata, 'npm', 'node_modules')
        else:
            # 回退到用户目录
            userprofile = os.environ.get('USERPROFILE', '')
            npm_modules = os.path.join(userprofile, 'AppData', 'Roaming', 'npm', 'node_modules')
    else:
        # Linux/macOS: 使用 npm root -g
        import subprocess
        result = subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True)
        if result.returncode != 0:
            print(f"{RED}[X] 无法获取 npm 全局目录{NC}")
            sys.exit(1)
        npm_modules = result.stdout.strip()

    cli_path = os.path.join(npm_modules, '@anthropic-ai', 'claude-code', 'cli.js')
    cli_bak = os.path.join(npm_modules, '@anthropic-ai', 'claude-code', 'cli.bak.js')

    # 调试信息
    print(f"[DEBUG] npm_modules: {npm_modules}")
    print(f"[DEBUG] cli_path: {cli_path}")
    print(f"[DEBUG] cli_path exists: {os.path.exists(cli_path)}")

    if not os.path.exists(cli_path):
        print(f"{RED}[X] 未找到 Claude Code CLI{NC}")
        print(f"{YELLOW}[TIP] 请先安装: npm install -g @anthropic-ai/claude-code{NC}")
        sys.exit(1)

    return cli_path, cli_bak

# ========== 加载关键词配置 ==========
def load_keywords(keyword_file):
    """加载关键词配置"""
    keywords = []
    if not os.path.exists(keyword_file):
        print(f"{RED}[X] 未找到关键词配置文件: {keyword_file}{NC}")
        sys.exit(1)

    with open(keyword_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            # 跳过空行和注释
            if not line or line.startswith('#'):
                continue
            # 跳过没有分隔符的行
            if '|' not in line:
                continue

            parts = line.split('|', 1)
            if len(parts) < 2:
                continue

            keyword = parts[0].strip()
            translation = parts[1].strip()

            if keyword and translation:
                # 安全检查：跳过可能误伤代码的词条
                # 1. 太短的词条容易误伤技术标识符
                if len(keyword) < 6:
                    print(f"  {YELLOW}[SKIP]{NC} 太短可能危险: {keyword}")
                    continue
                # 2. 包含下划线的可能是技术标识符
                if '_' in keyword:
                    print(f"  {YELLOW}[SKIP]{NC} 含下划线可能是代码: {keyword}")
                    continue
                keywords.append((keyword, translation))

    print(f"[INFO] 加载了 {len(keywords)} 个词条")
    return keywords

# ========== 创建备份 ==========
def create_backup(cli_path, cli_bak):
    """创建备份"""
    if not os.path.exists(cli_bak):
        shutil.copy(cli_path, cli_bak)
        print(f"{GREEN}[OK] 已创建备份: cli.bak.js{NC}")
    else:
        print(f"{YELLOW}[INFO] 备份已存在，跳过创建{NC}")

# ========== 执行汉化 ==========
def do_localize(cli_path, cli_bak, keywords):
    """执行汉化"""
    # 从备份恢复
    if os.path.exists(cli_bak):
        shutil.copy(cli_bak, cli_path)
        print(f"[INFO] 已从备份恢复原始文件")
    else:
        print(f"{RED}[X] 未找到备份文件，请先运行一次汉化{NC}")
        sys.exit(1)

    # 读取文件内容
    with open(cli_path, 'r', encoding='utf-8') as f:
        content = f.read()

    count = 0
    print(f"\n{MAGENTA}[*] 开始汉化...{NC}")
    for keyword, translation in keywords:
        # 直接替换文本（不依赖引号）
        if keyword in content:
            content = content.replace(keyword, translation)
            count += 1
            # 简化输出，避免编码问题
            print(f"  {GREEN}[+]{NC} replaced")

    # 保存汉化后的文件
    with open(cli_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"\n{MAGENTA}[*] 汉化完成！共处理 {count} 个词条{NC}")
    print("")
    print(f"{GREEN}[OK] 重启 Claude Code 即可看到中文界面{NC}")

# ========== 恢复英文 ==========
def restore_english(cli_path, cli_bak):
    """恢复英文界面"""
    if not os.path.exists(cli_bak):
        print(f"{YELLOW}[INFO] 未找到备份文件，可能未进行过汉化{NC}")
        return

    shutil.copy(cli_bak, cli_path)
    print(f"{GREEN}[OK] 已恢复英文界面{NC}")
    print(f"{YELLOW}[INFO] 重启 Claude Code 即可生效{NC}")

# ========== 主函数 ==========
def main():
    print(f"{MAGENTA}========================================{NC}")
    print(f"{MAGENTA}    Claude Code Localization Tool{NC}")
    print(f"{MAGENTA}========================================{NC}")
    print("")

    keyword_file = os.path.join(SCRIPT_DIR, "keyword.conf")

    # 获取 CLI 路径
    cli_path, cli_bak = get_cli_paths()
    print(f"{GREEN}[OK] Claude Code Path: {cli_path}{NC}")
    print("")

    # 检查是否是恢复模式
    if len(sys.argv) > 1 and sys.argv[1] == '--restore':
        restore_english(cli_path, cli_bak)
        return

    # 创建备份
    create_backup(cli_path, cli_bak)

    # 加载关键词
    keywords = load_keywords(keyword_file)

    # 执行汉化
    do_localize(cli_path, cli_bak, keywords)

if __name__ == "__main__":
    main()
