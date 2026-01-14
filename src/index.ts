#!/usr/bin/env node

import { findSessionFiles, parseSessionFile } from "./utils/claude-parser";
import { syncToOutput } from "./utils/sync";

interface Config {
  outputPath: string;
  claudeProjectPath?: string;
  autoGitCommit: boolean;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);

  let outputPath = "";
  let claudeProjectPath: string | undefined;
  let autoGitCommit = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--output" || arg === "-o") {
      outputPath = args[++i];
    } else if (arg === "--project" || arg === "-p") {
      claudeProjectPath = args[++i];
    } else if (arg === "--no-git") {
      autoGitCommit = false;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (!outputPath) {
      outputPath = arg;
    }
  }

  if (!outputPath) {
    console.error("Error: Output path is required");
    printHelp();
    process.exit(1);
  }

  return { outputPath, claudeProjectPath, autoGitCommit };
}

function printHelp(): void {
  console.log(`
Claude Log Sync - Export Claude Code conversations to Markdown

Usage:
  claude-log-sync <output-path> [options]
  claude-log-sync --output <path> [options]

Arguments:
  <output-path>    Path to output directory for markdown files

Options:
  -o, --output     Output directory for markdown files
  -p, --project    Path to specific Claude Code project directory
  --no-git         Disable automatic git commit after sync
  -h, --help       Show this help message

Examples:
  claude-log-sync ~/logs/claude
  claude-log-sync -o ~/logs/claude -p ~/.claude/projects/my-project
  claude-log-sync ~/logs/claude --no-git
`);
}

function main(): void {
  const config = parseArgs();

  console.log("Searching for Claude sessions...");

  const sessionFiles = findSessionFiles(config.claudeProjectPath);

  if (sessionFiles.length === 0) {
    console.log("No active Claude sessions found");
    return;
  }

  console.log(`Found ${sessionFiles.length} session(s)`);

  let totalMessages = 0;
  let syncedFiles = 0;

  for (const sessionFile of sessionFiles.slice(0, 3)) {
    const messages = parseSessionFile(sessionFile);
    const result = syncToOutput(
      sessionFile,
      messages,
      config.outputPath,
      config.autoGitCommit
    );

    if (result.success && result.messagesAdded > 0) {
      totalMessages += result.messagesAdded;
      syncedFiles++;
      console.log(`Synced: ${result.filePath}`);
    }
  }

  if (totalMessages > 0) {
    console.log(`Done: Synced ${totalMessages} messages from ${syncedFiles} session(s)`);
  } else {
    console.log("No new messages to sync");
  }
}

main();
