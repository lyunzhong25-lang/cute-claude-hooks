#!/usr/bin/env node
// localize.js - Claude Code 汉化脚本
// 支持旧版 JS 架构 + 新版原生二进制架构（安全模式）
// License: MIT

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MAGENTA = '\x1b[38;5;206m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[0;33m';
const RED = '\x1b[0;31m';
const CYAN = '\x1b[0;36m';
const NC = '\x1b[0m';

// 二进制模式下必须跳过的危险词（太短或太通用，会破坏代码逻辑）
const BINARY_BLOCKLIST = new Set([
  'Usage', 'Status', 'Config', 'Theme', 'Notifications', 'Language',
  'Model', 'Custom model',
  'Search settings...', 'Type to filter', '(↓ to select)',
  ' more above', ' more below', 'more below',
  'Esc to cancel', '· Esc to cancel',
  'Config dialog dismissed', 'shift+tab to cycle',
]);

// 二进制模式下的最小英文字节长度（低于此值跳过，避免误伤代码）
const BINARY_MIN_LENGTH = 15;

// ========== 获取 Claude Code 安装路径 ==========
function getClaudeCodeDir() {
  const pkgName = '@anthropic-ai/claude-code';
  let npmRoot;
  try {
    const log = execSync(`npm list -g ${pkgName} --depth=0`, { encoding: 'utf8' });
    if (!log.trim().includes(pkgName)) {
      console.log(`${RED}请先安装 Claude Code: npm install -g ${pkgName}${NC}`);
      process.exit(1);
    }
    npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  } catch (e) {
    console.log(`${RED}请先安装 Claude Code: npm install -g ${pkgName}${NC}`);
    process.exit(1);
  }
  return path.join(npmRoot, pkgName);
}

// ========== 检测架构 ==========
function detectArchitecture(claudeDir) {
  const cliJs = path.join(claudeDir, 'cli.js');
  const cliExe = path.join(claudeDir, 'bin', 'claude.exe');
  const cliBin = path.join(claudeDir, 'bin', 'claude');
  if (fs.existsSync(cliJs)) return { type: 'js', cliPath: cliJs };
  if (fs.existsSync(cliExe)) return { type: 'native', binaryPath: cliExe };
  if (fs.existsSync(cliBin)) return { type: 'native', binaryPath: cliBin };
  return { type: 'unknown' };
}

// ========== 转义正则特殊字符 ==========
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ========== 旧版 JS 架构汉化（全量替换，无限制） ==========
function localizeJs(cliPath) {
  const keywordFile = path.join(__dirname, 'keyword.js');
  const keyword = require(keywordFile);
  const cliBak = cliPath.replace(/\.js$/, '.bak.js');

  if (!fs.existsSync(cliBak)) {
    fs.copyFileSync(cliPath, cliBak);
    console.log(`${GREEN}已创建备份: cli.bak.js${NC}`);
  }
  fs.copyFileSync(cliBak, cliPath);

  let content = fs.readFileSync(cliPath, 'utf8');
  const entries = Object.entries(keyword);
  let totalReplacements = 0;
  let processedCount = 0;

  for (const [key, value] of entries) {
    const escapedKey = escapeRegex(key).replace(/\\n/g, '\\\\n');
    const newValue = value.replace(/\n/g, '\\n');
    let replaced = false;
    let count = 0;

    if (escapedKey.startsWith('`') || escapedKey.startsWith('\\')) {
      const regex = new RegExp(escapedKey, 'g');
      const m = content.match(regex);
      if (m) { content = content.replace(regex, value); replaced = true; count = m.length; }
    } else {
      const doubleRegex = new RegExp(`"${escapedKey}"`, 'g');
      const dm = content.match(doubleRegex);
      if (dm) { content = content.replace(doubleRegex, `"${newValue}"`); replaced = true; count += dm.length; }
      const singleRegex = new RegExp(`'${escapedKey}'`, 'g');
      const sm = content.match(singleRegex);
      if (sm) { content = content.replace(singleRegex, `'${newValue}'`); replaced = true; count += sm.length; }
    }

    if (replaced) {
      processedCount++;
      totalReplacements += count;
      console.log(`  ${GREEN}+${NC} ${key.substring(0, 50)}${key.length > 50 ? '...' : ''} ${YELLOW}->${NC} ${value.substring(0, 50)}`);
    }
  }

  fs.writeFileSync(cliPath, content, 'utf8');
  console.log('');
  console.log(`${MAGENTA}汉化完成! ${processedCount}/${entries.length} 条匹配, ${totalReplacements} 处替换${NC}`);
}

// ========== 新版二进制架构汉化（安全模式） ==========
function localizeBinary(binaryPath) {
  const keywordFile = path.join(__dirname, 'keyword.js');
  const keyword = require(keywordFile);

  const bakPath = binaryPath + '.bak';
  if (!fs.existsSync(bakPath)) {
    const sizeMB = Math.round(fs.statSync(binaryPath).size / 1024 / 1024);
    console.log(`${CYAN}正在备份原始文件（约 ${sizeMB}MB），请稍候...${NC}`);
    fs.copyFileSync(binaryPath, bakPath);
    console.log(`${GREEN}已创建备份${NC}`);
  }

  // 从备份恢复，确保基于原始文件替换
  console.log(`${CYAN}从备份恢复原始文件...${NC}`);
  fs.copyFileSync(bakPath, binaryPath);

  let buffer = fs.readFileSync(binaryPath);

  const entries = Object.entries(keyword);
  let replacedCount = 0;
  let skippedShort = 0;
  let skippedBlock = 0;
  let skippedSize = 0;
  let skippedTemplate = 0;
  let skippedNotFound = 0;
  let totalOccurrences = 0;

  console.log('');
  console.log(`${MAGENTA}开始安全二进制替换（跳过短词和通用词）...${NC}`);
  console.log('');

  for (const [english, chinese] of entries) {
    // 跳过模板语法
    if (english.includes('${') || english.startsWith('`')) {
      skippedTemplate++;
      continue;
    }

    // 跳过黑名单词
    if (BINARY_BLOCKLIST.has(english)) {
      skippedBlock++;
      continue;
    }

    // 跳过太短的词（容易误伤代码）
    if (Buffer.from(english, 'utf8').length < BINARY_MIN_LENGTH) {
      skippedShort++;
      continue;
    }

    const engBuf = Buffer.from(english, 'utf8');
    const cnBuf = Buffer.from(chinese, 'utf8');

    // 中文字节数超过英文字节数则跳过
    if (cnBuf.length > engBuf.length) {
      skippedSize++;
      continue;
    }

    // 用空格填充到与原文相同字节长度
    const padded = Buffer.alloc(engBuf.length, 0x20);
    cnBuf.copy(padded);

    let count = 0;
    let pos = 0;
    while ((pos = buffer.indexOf(engBuf, pos)) !== -1) {
      padded.copy(buffer, pos);
      pos += engBuf.length;
      count++;
    }

    if (count > 0) {
      replacedCount++;
      totalOccurrences += count;
      const engDisplay = english.substring(0, 38).padEnd(38);
      const cnDisplay = chinese.substring(0, 25);
      console.log(`  ${GREEN}+${NC} ${engDisplay} → ${cnDisplay} ${YELLOW}(${count}处)${NC}`);
    } else {
      skippedNotFound++;
    }
  }

  console.log('');
  console.log(`${CYAN}写入修改后的二进制文件...${NC}`);
  fs.writeFileSync(binaryPath, buffer);

  console.log('');
  console.log(`${MAGENTA}${'='.repeat(50)}${NC}`);
  console.log(`${MAGENTA}二进制汉化完成（安全模式）!${NC}`);
  console.log(`${GREEN}  成功替换: ${replacedCount} 条, 共 ${totalOccurrences} 处${NC}`);
  console.log(`${YELLOW}  跳过: 短词 ${skippedShort} | 黑名单 ${skippedBlock} | 字节超出 ${skippedSize} | 模板 ${skippedTemplate} | 未找到 ${skippedNotFound}${NC}`);
  console.log(`${MAGENTA}${'='.repeat(50)}${NC}`);
}

// ========== 主流程 ==========
function main() {
  console.log(`${MAGENTA}==============================================${NC}`);
  console.log(`${MAGENTA}     Claude Code 汉化工具${NC}`);
  console.log(`${MAGENTA}==============================================${NC}`);
  console.log('');

  const claudeDir = getClaudeCodeDir();
  const arch = detectArchitecture(claudeDir);

  console.log(`${CYAN}安装路径: ${claudeDir}${NC}`);
  console.log(`${CYAN}架构类型: ${arch.type}${NC}`);
  console.log('');

  if (arch.type === 'js') {
    console.log(`${GREEN}检测到旧版 JS 架构，执行全量汉化...${NC}\n`);
    localizeJs(arch.cliPath);
  } else if (arch.type === 'native') {
    console.log(`${YELLOW}检测到新版原生二进制架构 (v2.x+)${NC}`);
    console.log(`${CYAN}使用安全模式：只替换长且唯一的 UI 字符串，跳过通用短词${NC}\n`);
    localizeBinary(arch.binaryPath);
  } else {
    console.log(`${RED}无法识别 Claude Code 的安装结构${NC}`);
    try { fs.readdirSync(claudeDir).forEach(f => console.log(`  ${f}`)); } catch (e) {}
    console.log(`${YELLOW}请确认 Claude Code 已正确安装${NC}`);
    return;
  }

  console.log('');
  console.log(`${YELLOW}请重启 Claude Code 使汉化生效${NC}`);
  console.log(`${CYAN}如需恢复原版，删除 .bak 文件后重新安装 Claude Code${NC}`);
}

main();
