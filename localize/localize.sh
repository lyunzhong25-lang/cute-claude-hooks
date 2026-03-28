#!/bin/bash
# localize.sh - Claude Code 界面汉化脚本
# 来源: 基于 mine-auto-cli (https://github.com/biaov/mine-auto-cli) 改进
# License: MIT

set -e

# ========== 颜色定义 ==========
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
MAGENTA='\033[38;5;206m'
NC='\033[0m'

# ========== 路径定义 ==========
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEYWORD_FILE="$SCRIPT_DIR/keyword.conf"

# ========== 获取 Claude Code CLI 路径 ==========
get_cli_path() {
    local pkgname="@anthropic-ai/claude-code"

    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ 未找到 npm，请先安装 Node.js${NC}"
        exit 1
    fi

    local npm_root
    npm_root=$(npm root -g 2>/dev/null)

    if [ -z "$npm_root" ]; then
        echo -e "${RED}❌ 无法获取 npm 全局目录${NC}"
        exit 1
    fi

    local cli_path="$npm_root/$pkgname/cli.js"
    local cli_bak="$npm_root/$pkgname/cli.bak.js"

    if [ ! -f "$cli_path" ]; then
        echo -e "${RED}❌ 未找到 Claude Code CLI，请先安装: npm install -g @anthropic-ai/claude-code${NC}"
        exit 1
    fi

    echo "$cli_path|$cli_bak"
}

# ========== 主函数 ==========
main() {
    echo -e "${MAGENTA}╔══════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║     🌸 Claude Code 界面汉化工具 🌸       ║${NC}"
    echo -e "${MAGENTA}╚══════════════════════════════════════════╝${NC}"
    echo ""

    # 检查关键词文件
    if [ ! -f "$KEYWORD_FILE" ]; then
        echo -e "${RED}❌ 未找到关键词配置文件: $KEYWORD_FILE${NC}"
        exit 1
    fi

    # 获取 CLI 路径
    local paths
    paths=$(get_cli_path)
    local cli_path=$(echo "$paths" | cut -d'|' -f1)
    local cli_bak=$(echo "$paths" | cut -d'|' -f2)

    echo -e "${GREEN}📁 Claude Code 路径: $cli_path${NC}"
    echo ""

    # 创建备份
    if [ ! -f "$cli_bak" ]; then
        cp "$cli_path" "$cli_bak"
        echo -e "${GREEN}✅ 已创建备份: cli.bak.js${NC}"
    else
        echo -e "${YELLOW}ℹ️  备份已存在，跳过创建${NC}"
    fi

    # 从备份恢复
    if [ -f "$cli_bak" ]; then
        cp "$cli_bak" "$cli_path"
    fi

    # 优先使用 Node.js 脚本（安全替换，只替换 description 字段）
    local js_script="$SCRIPT_DIR/localize.js"
    if [ -f "$js_script" ] && command -v node &> /dev/null; then
        echo -e "${GREEN}🔧 使用 Node.js 安全替换模式${NC}"
        echo ""
        node "$js_script"
    else
        echo -e "${YELLOW}⚠️  Node.js 脚本不可用，使用 sed 模式（可能不够精确）${NC}"
        echo ""
        # Fallback: sed 模式（仅替换 description:"..." 中的内容）
        do_localize_sed "$cli_path"
    fi
}

# ========== sed 模式（备选方案）==========
do_localize_sed() {
    local cli_path="$1"
    local count=0

    echo -e "${MAGENTA}🌸 开始汉化（sed 模式）...${NC}"
    echo ""

    while IFS='|' read -r keyword translation || [ -n "$keyword" ]; do
        [ -z "$keyword" ] && continue
        [[ "$keyword" =~ ^[[:space:]]*# ]] && continue

        keyword=$(echo "$keyword" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        translation=$(echo "$translation" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

        [ -z "$keyword" ] && continue

        local escaped_key
        escaped_key=$(echo "$keyword" | sed 's/[\/&]/\\&/g')

        # 安全替换：只替换 description:"..." 中的内容
        if sed -i.bak "s/description:\"${escaped_key}\"/description:\"${translation}\"/g" "$cli_path" 2>/dev/null; then
            count=$((count + 1))
            echo -e "  ${GREEN}✓${NC} $keyword ${YELLOW}→${NC} $translation"
        fi

    done < "$KEYWORD_FILE"

    rm -f "${cli_path}.bak"

    echo ""
    echo -e "${MAGENTA}🌸 汉化完成！共处理 $count 个词条${NC}"
    echo -e "${YELLOW}ℹ️  重启 Claude Code 即可生效${NC}"
}

main "$@"
