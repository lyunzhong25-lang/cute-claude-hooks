#!/usr/bin/env node

/**
 * Cute Claude Hooks - 恢复脚本
 * 恢复 Claude Code 英文界面
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { arch } = require('os');

const MAGENTA = '\x1b[38;5;206m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[0;33m';
const RED = '\x1b[0;31m';
const NC = '\x1b[0m';

console.log(`\n${MAGENTA}恢复 Claude Code 英文界面...${NC}\n`);

function getClaudeCodeDir() {
  const pkgName = '@anthropic-ai/claude-code';
  const log = execSync(`npm list -g ${pkgName} --depth=0`, { encoding: 'utf8' });
  if (!log.trim().includes(pkgName)) {
    throw new Error('未找到 Claude Code');
  }

  const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  return path.join(npmRoot, pkgName);
}

function getPlatformKey() {
  let cpu = arch();
  if (process.platform === 'linux') {
    const report = typeof process.report?.getReport === 'function' ? process.report.getReport() : null;
    const musl = report != null && report.header?.glibcVersionRuntime === undefined;
    return `linux-${cpu}${musl ? '-musl' : ''}`;
  }
  return `${process.platform}-${cpu}`;
}

function getNativePackageBinary() {
  const platformKey = getPlatformKey();
  const suffix = platformKey === 'win32-x64' || platformKey === 'win32-arm64' ? 'claude.exe' : 'claude';
  const packageName = `@anthropic-ai/claude-code-${platformKey}`;

  try {
    const pkgJson = require.resolve(`${packageName}/package.json`);
    const binaryPath = path.join(path.dirname(pkgJson), suffix);
    if (fs.existsSync(binaryPath)) return binaryPath;
  } catch (e) {}

  return null;
}

function getBackupPairs(claudeDir) {
  const cliPath = path.join(claudeDir, 'cli.js');
  const cliBak = path.join(claudeDir, 'cli.bak.js');
  const binaryCandidates = [
    path.join(claudeDir, 'bin', 'claude.exe'),
    path.join(claudeDir, 'bin', 'claude'),
    getNativePackageBinary(),
  ].filter(Boolean);

  const pairs = [];
  if (fs.existsSync(cliBak)) pairs.push({ backup: cliBak, target: cliPath });
  for (const binaryPath of binaryCandidates) {
    const backup = binaryPath + '.bak';
    if (fs.existsSync(backup)) pairs.push({ backup, target: binaryPath });
  }
  return pairs;
}

try {
  const claudeDir = getClaudeCodeDir();
  const pairs = getBackupPairs(claudeDir);

  if (pairs.length === 0) {
    console.log(`${YELLOW}未找到备份文件，可能已经是英文版${NC}`);
  } else {
    for (const pair of pairs) {
      fs.copyFileSync(pair.backup, pair.target);
      console.log(`${GREEN}已恢复: ${pair.target}${NC}`);
    }
    console.log(`${GREEN}已恢复为英文界面${NC}`);
  }
} catch (err) {
  console.log(`${RED}恢复失败: ${err.message}${NC}`);
}

console.log(`\n${MAGENTA}请重启 Claude Code 使更改生效${NC}\n`);
