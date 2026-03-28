#!/usr/bin/env node
// localize.js - Claude Code safe localization script
// Only replaces strings in description:"..." fields to avoid breaking code logic
// License: MIT

const fs = require('fs');
const path = require('path');

// ========== Get Claude Code CLI path ==========
function getCliPath() {
    const { execSync } = require('child_process');
    let npmRoot;
    try {
        npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    } catch (e) {
        console.log('\x1b[31mError: Cannot find npm. Please install Node.js first.\x1b[0m');
        process.exit(1);
    }

    const cliPath = path.join(npmRoot, '@anthropic-ai', 'claude-code', 'cli.js');
    const cliBak = path.join(npmRoot, '@anthropic-ai', 'claude-code', 'cli.bak.js');

    if (!fs.existsSync(cliPath)) {
        console.log('\x1b[31mError: Claude Code CLI not found. Install with: npm install -g @anthropic-ai/claude-code\x1b[0m');
        process.exit(1);
    }

    return { cliPath, cliBak };
}

// ========== Parse keyword.conf ==========
function parseKeywords(keywordFile) {
    const content = fs.readFileSync(keywordFile, 'utf8');
    const pairs = [];

    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const pipeIdx = trimmed.indexOf('|');
        if (pipeIdx === -1) continue;

        const keyword = trimmed.substring(0, pipeIdx).trim();
        const translation = trimmed.substring(pipeIdx + 1).trim();

        if (keyword && translation) {
            pairs.push({ keyword, translation });
        }
    }

    return pairs;
}

// ========== Safe replacement ==========
// ONLY replace description:"keyword" patterns
// This is the ONLY safe way to localize - description fields are display-only text
function safeReplace(src, keyword, translation) {
    let count = 0;

    // Replace description:"keyword" (double-quoted description values)
    const escaped = escapeRegex(keyword);
    const descDoubleRegex = new RegExp(`(description:")(${escaped})(")`, 'g');
    src = src.replace(descDoubleRegex, (match, prefix, content, suffix) => {
        count++;
        return `${prefix}${translation}${suffix}`;
    });

    // Replace description:`keyword` (template literal description values)
    const descTmplRegex = new RegExp(`(description:\`)(${escaped})(\`)`, 'g');
    src = src.replace(descTmplRegex, (match, prefix, content, suffix) => {
        count++;
        return `${prefix}${translation}${suffix}`;
    });

    return { src, count };
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ========== Main ==========
function main() {
    console.log('\x1b[38;5;206m==============================================\x1b[0m');
    console.log('\x1b[38;5;206m     Claude Code Localization Tool\x1b[0m');
    console.log('\x1b[38;5;206m==============================================\x1b[0m');
    console.log('');

    // Find keyword file
    const scriptDir = path.dirname(process.argv[1] || __filename);
    const keywordFile = path.join(scriptDir, 'keyword.conf');

    if (!fs.existsSync(keywordFile)) {
        console.log('\x1b[31mError: Keyword config not found: ' + keywordFile + '\x1b[0m');
        process.exit(1);
    }

    // Get CLI path
    const { cliPath, cliBak } = getCliPath();
    console.log('\x1b[32mPath: ' + cliPath + '\x1b[0m');
    console.log('');

    // Create backup
    if (!fs.existsSync(cliBak)) {
        fs.copyFileSync(cliPath, cliBak);
        console.log('\x1b[32mOK: Backup created\x1b[0m');
    } else {
        console.log('\x1b[33mInfo: Backup exists, skipping\x1b[0m');
    }

    // Restore from backup first
    fs.copyFileSync(cliBak, cliPath);

    // Parse keywords
    const pairs = parseKeywords(keywordFile);
    console.log('\x1b[38;5;206mStarting localization... (' + pairs.length + ' entries)\x1b[0m');
    console.log('');

    // Read source
    let src = fs.readFileSync(cliPath, 'utf8');
    let totalReplacements = 0;
    let processedCount = 0;

    for (const { keyword, translation } of pairs) {
        const result = safeReplace(src, keyword, translation);
        if (result.count > 0) {
            src = result.src;
            totalReplacements += result.count;
            processedCount++;
            console.log(`  \x1b[32m+\x1b[0m ${keyword} \x1b[33m->\x1b[0m ${translation}`);
        }
    }

    // Write result
    fs.writeFileSync(cliPath, src, 'utf8');

    console.log('');
    console.log(`\x1b[38;5;206mLocalization complete! ${processedCount} entries, ${totalReplacements} replacements\x1b[0m`);
    console.log('\x1b[33mInfo: Restart Claude Code to take effect\x1b[0m');
}

main();
