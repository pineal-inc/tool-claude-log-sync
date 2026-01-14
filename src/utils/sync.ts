import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { ClaudeMessage, getTodayMessages } from "./claude-parser";

export interface SyncResult {
  success: boolean;
  filePath: string;
  messagesAdded: number;
  error?: string;
}

export interface SyncState {
  lastSyncedLines: Record<string, number>;
}

const STATE_FILE = ".claude-sync-state.json";

function getStateFilePath(outputDir: string): string {
  return path.join(outputDir, STATE_FILE);
}

export function loadSyncState(outputDir: string): SyncState {
  const stateFile = getStateFilePath(outputDir);
  try {
    if (fs.existsSync(stateFile)) {
      const content = fs.readFileSync(stateFile, "utf-8");
      return JSON.parse(content);
    }
  } catch {
    // Ignore errors, return default state
  }
  return { lastSyncedLines: {} };
}

export function saveSyncState(outputDir: string, state: SyncState): void {
  const stateFile = getStateFilePath(outputDir);
  try {
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch {
    // Ignore errors
  }
}

function formatDateJapanese(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

function formatMessagesToMarkdown(messages: ClaudeMessage[]): string {
  const lines: string[] = [];

  for (const msg of messages) {
    if (msg.type === "user") {
      lines.push(`**ユーザー**: ${msg.content}`);
    } else {
      lines.push(`**Claude**: ${msg.content}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function syncToOutput(
  sessionFilePath: string,
  allMessages: ClaudeMessage[],
  outputDir: string,
  autoGitCommit: boolean
): SyncResult {
  try {
    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Filter to today's messages
    const messages = getTodayMessages(allMessages);
    if (messages.length === 0) {
      return {
        success: true,
        filePath: "",
        messagesAdded: 0,
      };
    }

    // Load sync state
    const state = loadSyncState(outputDir);
    const lastSyncedLine = state.lastSyncedLines[sessionFilePath] || 0;

    // Get the current line count of the session file
    const sessionContent = fs.readFileSync(sessionFilePath, "utf-8");
    const currentLineCount = sessionContent.split("\n").filter((l) => l.trim()).length;

    // If no new lines, nothing to sync
    if (currentLineCount <= lastSyncedLine) {
      return {
        success: true,
        filePath: "",
        messagesAdded: 0,
      };
    }

    // Calculate new messages to append
    // This is approximate - we sync all today's messages if there are new lines
    const today = formatDateJapanese(new Date());
    const outputFile = path.join(outputDir, `${today}.md`);

    // Create file with header if it doesn't exist
    let existingContent = "";
    if (fs.existsSync(outputFile)) {
      existingContent = fs.readFileSync(outputFile, "utf-8");
    } else {
      existingContent = `# ${today} Claudeとの会話\n\n`;
    }

    // For simplicity in append mode, we rewrite with all today's messages
    // A more sophisticated version would track individual message IDs
    const markdown = formatMessagesToMarkdown(messages);
    const newContent = `# ${today} Claudeとの会話\n\n${markdown}`;

    fs.writeFileSync(outputFile, newContent);

    // Update sync state
    state.lastSyncedLines[sessionFilePath] = currentLineCount;
    saveSyncState(outputDir, state);

    // Git commit if enabled
    if (autoGitCommit) {
      try {
        execSync(`cd "${outputDir}" && git add "${outputFile}" && git commit -m "Claude: ${today} (auto)" 2>/dev/null`, {
          encoding: "utf-8",
          stdio: "pipe",
        });
      } catch {
        // Git commit might fail if no changes or not a git repo - that's OK
      }
    }

    return {
      success: true,
      filePath: outputFile,
      messagesAdded: messages.length,
    };
  } catch (error) {
    return {
      success: false,
      filePath: "",
      messagesAdded: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
