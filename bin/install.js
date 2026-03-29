#!/usr/bin/env node

/**
 * Cute Claude Hooks - NPM 安装脚本
 * 安装粉色提示钩子 + 界面汉化
 * 完整支持 Windows / macOS / Linux
 * License: MIT
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const MAGENTA = '\x1b[38;5;206m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[0;33m';
const RED = '\x1b[0;31m';
const NC = '\x1b[0m';
const IS_WIN = process.platform === 'win32';

console.log(`\n${MAGENTA}==============================================${NC}`);
console.log(`${MAGENTA}     Cute Claude Hooks 安装器${NC}`);
console.log(`${MAGENTA}==============================================${NC}\n`);

// 路径常量
const homeDir = os.homedir();
const claudeDir = path.join(homeDir, '.claude');
const hooksDir = path.join(claudeDir, 'hooks');
const localizeDir = path.join(claudeDir, 'localize');

// 获取 npm 包目录
let npmDir;
try {
  npmDir = path.dirname(require.resolve('cute-claude-hooks/package.json'));
} catch (e) {
  npmDir = path.resolve(__dirname, '..');
}

console.log(`${GREEN}包目录: ${npmDir}${NC}`);
console.log(`${GREEN}系统: ${IS_WIN ? 'Windows' : process.platform}${NC}\n`);

// ========== 工具函数 ==========
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`${GREEN}已创建: ${dir}${NC}`);
  }
}

function copyFile(src, dest) {
  try {
    fs.copyFileSync(src, dest);
    console.log(`${GREEN}已复制: ${path.basename(dest)}${NC}`);
    return true;
  } catch (err) {
    console.log(`${YELLOW}复制失败: ${path.basename(dest)} - ${err.message}${NC}`);
    return false;
  }
}

/**
 * 将文件内容确保为 LF 换行（bash 脚本必需）
 * npm install 在 Windows 上可能把 LF 转为 CRLF
 */
function ensureLfLineEndings(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('\r\n')) {
      content = content.replace(/\r\n/g, '\n');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`${GREEN}已修复换行符: ${path.basename(filePath)} (CRLF → LF)${NC}`);
    }
  } catch (err) {
    console.log(`${YELLOW}换行符检查失败: ${err.message}${NC}`);
  }
}

/**
 * Windows 下查找 Git Bash 路径（与 Claude Code 的 cr8() 逻辑一致）
 * 1. 优先查 CLAUDE_CODE_GIT_BASH_PATH 环境变量
 * 2. 查 git.exe 位置 → 推算 bash.exe
 * 3. 查常见安装路径
 */
function findGitBash() {
  if (!IS_WIN) return null;

  // 1. 环境变量
  if (process.env.CLAUDE_CODE_GIT_BASH_PATH) {
    if (fs.existsSync(process.env.CLAUDE_CODE_GIT_BASH_PATH)) {
      console.log(`${GREEN}使用环境变量 CLAUDE_CODE_GIT_BASH_PATH${NC}`);
      return process.env.CLAUDE_CODE_GIT_BASH_PATH;
    }
  }

  // 2. 通过 git.exe 推算
  try {
    const gitPath = execSync('where git.exe', { encoding: 'utf8', timeout: 5000 }).trim().split('\n')[0].trim();
    if (gitPath) {
      // git.exe 通常在 Git/cmd/ 或 Git/bin/ 或 Git/mingw64/bin/
      const gitDir = path.dirname(gitPath);
      const possibleBash = [
        path.join(gitDir, '..', 'bin', 'bash.exe'),
        path.join(gitDir, '..', '..', 'bin', 'bash.exe'),
        path.join(gitDir, 'bash.exe'),
      ];
      for (const p of possibleBash) {
        const resolved = path.resolve(p);
        if (fs.existsSync(resolved)) {
          console.log(`${GREEN}找到 Git Bash: ${resolved}${NC}`);
          return resolved;
        }
      }
    }
  } catch (e) { /* git not found */ }

  // 3. 常见安装路径
  const commonPaths = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    path.join(os.homedir(), 'scoop', 'apps', 'git', 'current', 'bin', 'bash.exe'),
    'D:\\Git\\bin\\bash.exe',
  ];
  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      console.log(`${GREEN}找到 Git Bash: ${p}${NC}`);
      return p;
    }
  }

  return null;
}

// ========== 安装钩子 ==========
function installHook() {
  console.log(`${MAGENTA}[1/2] 安装粉色提示钩子...${NC}\n`);

  ensureDir(hooksDir);

  const hookSrc = path.join(npmDir, 'tool-tips-post.sh');
  const hookDest = path.join(hooksDir, 'tool-tips-post.sh');

  if (!fs.existsSync(hookSrc)) {
    console.log(`${RED}找不到钩子脚本: ${hookSrc}${NC}`);
    console.log(`${YELLOW}请确认 npm 包完整性${NC}`);
    return;
  }

  // 复制 hook 脚本
  copyFile(hookSrc, hookDest);

  // 关键：确保 LF 换行（Windows npm install 可能转为 CRLF）
  ensureLfLineEndings(hookDest);

  // Unix 设置执行权限
  if (!IS_WIN) {
    try { fs.chmodSync(hookDest, '755'); } catch (err) {}
  }

  // Windows 特殊检查
  if (IS_WIN) {
    console.log('');
    const bashPath = findGitBash();
    if (!bashPath) {
      console.log(`${RED}${'='.repeat(45)}${NC}`);
      console.log(`${RED}  未找到 Git Bash!${NC}`);
      console.log(`${RED}  Claude Code hooks 在 Windows 上需要 Git Bash${NC}`);
      console.log(`${RED}  请安装 Git for Windows:${NC}`);
      console.log(`${RED}  https://git-scm.com/downloads/win${NC}`);
      console.log(`${RED}${'='.repeat(45)}${NC}\n`);
      return;
    }
  }

  // 更新 settings.json
  updateSettings(hookDest);
}

// ========== 更新 settings.json ==========
function updateSettings(hookPath) {
  const settingsFile = path.join(claudeDir, 'settings.json');
  let settings = {};

  if (fs.existsSync(settingsFile)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    } catch (err) {
      console.log(`${YELLOW}警告: 无法读取 settings.json，将创建新文件${NC}`);
    }
  }

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];

  // 使用正斜杠路径（Claude Code 内部统一使用正斜杠）
  const normalizedPath = hookPath.replace(/\\/g, '/');

  // matcher 匹配所有常用工具 + MCP 工具
  const matcher = 'Bash|Read|Write|Edit|Glob|Grep|mcp__*';

  // 检查是否已存在同 matcher 的配置
  const existingIdx = settings.hooks.PostToolUse.findIndex(h => h.matcher === matcher);

  // hook command：直接用路径，不加引号不加 bash 前缀
  // Claude Code 的 mg8() 会自动通过 cr8() 找到 bash 并包装执行
  const hookEntry = {
    type: 'command',
    command: normalizedPath,
  };

  const hookConfig = {
    matcher: matcher,
    hooks: [hookEntry]
  };

  if (existingIdx >= 0) {
    // 更新已有配置
    settings.hooks.PostToolUse[existingIdx] = hookConfig;
    console.log(`${GREEN}已更新: PostToolUse 钩子配置${NC}`);
  } else {
    // 新增配置
    settings.hooks.PostToolUse.push(hookConfig);
    console.log(`${GREEN}已添加: PostToolUse 钩子配置${NC}`);
  }

  try {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
    console.log(`${GREEN}已保存: ${settingsFile}${NC}`);
  } catch (err) {
    console.log(`${YELLOW}警告: 无法写入 settings.json - ${err.message}${NC}`);
    console.log(`${YELLOW}请手动添加以下配置到 settings.json:${NC}`);
    console.log(JSON.stringify({ hooks: { PostToolUse: [hookConfig] } }, null, 2));
  }
}

// ========== 安装汉化 ==========
function installLocalize() {
  console.log(`\n${MAGENTA}[2/2] 安装界面汉化...${NC}\n`);

  ensureDir(localizeDir);

  // 核心文件
  const files = ['keyword.js', 'localize.js'];

  files.forEach(file => {
    const src = path.join(npmDir, 'localize', file);
    const dest = path.join(localizeDir, file);
    if (fs.existsSync(src)) {
      copyFile(src, dest);
    } else {
      console.log(`${YELLOW}缺少文件: ${file}${NC}`);
    }
  });

  // 执行汉化
  console.log(`\n${MAGENTA}执行汉化...${NC}`);

  try {
    const jsScript = path.join(localizeDir, 'localize.js');
    if (fs.existsSync(jsScript)) {
      execSync(`node "${jsScript}"`, { stdio: 'inherit' });
    }
  } catch (err) {
    console.log(`${YELLOW}警告: 汉化过程中遇到问题${NC}`);
    console.log(`${YELLOW}可手动执行: node ~/.claude/localize/localize.js${NC}`);
  }
}

// ========== 主流程 ==========
function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'all';

  switch (mode) {
    case 'hook':
    case '1':
      installHook();
      break;
    case 'localize':
    case '2':
      installLocalize();
      break;
    case 'all':
    default:
      installHook();
      installLocalize();
      break;
  }

  console.log(`\n${MAGENTA}${'='.repeat(45)}${NC}`);
  console.log(`${MAGENTA}  安装完成!${NC}`);
  console.log(`${MAGENTA}${'='.repeat(45)}${NC}`);
  console.log(`${YELLOW}请重启 Claude Code 使所有更改生效${NC}`);
  console.log(`${YELLOW}文档: https://github.com/gugug168/cute-claude-hooks${NC}\n`);
}

main();
