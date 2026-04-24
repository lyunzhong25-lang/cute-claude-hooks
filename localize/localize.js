#!/usr/bin/env node
// localize.js - Claude Code 汉化脚本
// 支持旧版 JS 架构（字符串替换）和新版原生二进制架构（二进制替换）
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

// ========== 旧版 JS 架构汉化 ==========
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

// ========== 移除 PE 数字签名 ==========
function stripPESignature(buffer) {
  if (buffer[0] !== 0x4D || buffer[1] !== 0x5A) throw new Error('不是有效的 PE 文件');
  const peOffset = buffer.readUInt32LE(0x3C);
  if (buffer.readUInt32LE(peOffset) !== 0x00004550) throw new Error('PE 签名无效');

  const optHeaderOffset = peOffset + 24;
  const magic = buffer.readUInt16LE(optHeaderOffset);

  let secDirOffset;
  if (magic === 0x20B) {        // PE32+ 64位
    secDirOffset = optHeaderOffset + 112 + 4 * 8;
  } else if (magic === 0x10B) { // PE32 32位
    secDirOffset = optHeaderOffset + 96 + 4 * 8;
  } else {
    throw new Error(`未知 PE magic: 0x${magic.toString(16)}`);
  }

  // 将安全目录条目清零（VirtualAddress + Size 各 4 字节）
  buffer.writeUInt32LE(0, secDirOffset);
  buffer.writeUInt32LE(0, secDirOffset + 4);
  return buffer;
}

// ========== 新版二进制架构汉化 ==========
function localizeBinary(binaryPath) {
  const keywordFile = path.join(__dirname, 'keyword.js');
  const keyword = require(keywordFile);

  const bakPath = binaryPath + '.bak';
  if (!fs.existsSync(bakPath)) {
    const sizeMB = Math.round(fs.statSync(binaryPath).size / 1024 / 1024);
    console.log(`${CYAN}正在备份原始文件（约 ${sizeMB}MB），请稍候...${NC}`);
    fs.copyFileSync(binaryPath, bakPath);
    console.log(`${GREEN}已创建备份: claude.exe.bak${NC}`);
  }

  // 每次从备份恢复，确保基于原始文件替换
  console.log(`${CYAN}从备份恢复原始文件...${NC}`);
  fs.copyFileSync(bakPath, binaryPath);

  let buffer = fs.readFileSync(binaryPath);

  // 移除数字签名
  try {
    buffer = stripPESignature(buffer);
    console.log(`${GREEN}已移除数字签名${NC}`);
  } catch (e) {
    console.log(`${YELLOW}警告: 无法移除签名 (${e.message})，继续尝试替换...${NC}`);
  }

  const entries = Object.entries(keyword);
  let replacedCount = 0;
  let skippedCount = 0;
  let totalOccurrences = 0;

  console.log('');
  console.log(`${MAGENTA}开始二进制字符串替换...${NC}`);
  console.log('');

  for (const [english, chinese] of entries) {
    // 跳过模板语法条目（二进制里不会有这种格式）
    if (english.includes('${') || english.startsWith('`')) {
      skippedCount++;
      continue;
    }

    const engBuf = Buffer.from(english, 'utf8');
    const cnBuf = Buffer.from(chinese, 'utf8');

    // 中文字节数超过英文字节数则跳过
    if (cnBuf.length > engBuf.length) {
      skippedCount++;
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
      skippedCount++;
    }
  }

  console.log('');
  console.log(`${CYAN}写入修改后的二进制文件...${NC}`);
  fs.writeFileSync(binaryPath, buffer);

  console.log('');
  console.log(`${MAGENTA}${'='.repeat(50)}${NC}`);
  console.log(`${MAGENTA}二进制汉化完成!${NC}`);
  console.log(`${GREEN}  成功替换: ${replacedCount} 条字符串, 共 ${totalOccurrences} 处${NC}`);
  console.log(`${YELLOW}  跳过: ${skippedCount} 条 (中文字节数超出或含模板语法)${NC}`);
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
    console.log(`${GREEN}检测到旧版 JS 架构，执行字符串替换汉化...${NC}\n`);
    localizeJs(arch.cliPath);
    console.log(`${YELLOW}请重启 Claude Code 使汉化生效${NC}`);

  } else if (arch.type === 'native') {
    console.log(`${YELLOW}检测到新版原生二进制架构 (v2.x+)${NC}`);
    console.log(`${CYAN}将对二进制文件进行字符串替换（仅替换字节数匹配的条目）${NC}\n`);
    localizeBinary(arch.binaryPath);
    console.log(`${YELLOW}请重启 Claude Code 使汉化生效${NC}`);
    console.log(`${CYAN}注: 部分字符串因中文字节数超出英文而无法替换，属正常现象${NC}`);

  } else {
    console.log(`${RED}无法识别 Claude Code 的安装结构${NC}`);
    try {
      fs.readdirSync(claudeDir).forEach(f => console.log(`  ${f}`));
    } catch (e) {}
    console.log(`${YELLOW}请确认 Claude Code 已正确安装${NC}`);
  }
}

main();
