import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface ClaudeMessage {
  type: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface FileIndex {
  mtime: number;
  size: number;
}

export interface ScanIndex {
  files: Record<string, FileIndex>;
  lastScan: number;
}

export interface ClaudeSession {
  filePath: string;
  projectName: string;
  messages: ClaudeMessage[];
  lastModified: Date;
}

// Patterns to filter out noise
const NOISE_PATTERNS = [
  /<local-command/i,
  /<command-name>/i,
  /<system-reminder>/i,
  /<task-notification>/i,
  /^No response requested/i,
];

function isNoiseMessage(content: string): boolean {
  return NOISE_PATTERNS.some((pattern) => pattern.test(content));
}

function parseJsonlLine(line: string): ClaudeMessage | null {
  try {
    const parsed = JSON.parse(line);

    if (parsed.type === "user") {
      const content = parsed.message?.content || parsed.content || "";

      if (typeof content === "string" && !isNoiseMessage(content)) {
        return {
          type: "user",
          content: content.trim(),
          timestamp: parsed.timestamp || "",
        };
      }
    } else if (parsed.type === "assistant") {
      if (Array.isArray(parsed.message?.content)) {
        const textBlocks = parsed.message.content
          .filter((block: { type: string; text?: string }) => block.type === "text")
          .map((block: { type: string; text: string }) => block.text)
          .filter((text: string) => !isNoiseMessage(text));

        if (textBlocks.length > 0) {
          return {
            type: "assistant",
            content: textBlocks.join("\n\n").trim(),
            timestamp: parsed.timestamp || "",
          };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function parseSessionFile(filePath: string): ClaudeMessage[] {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());

    const messages: ClaudeMessage[] = [];
    for (const line of lines) {
      const message = parseJsonlLine(line);
      if (message) {
        messages.push(message);
      }
    }

    return messages;
  } catch {
    return [];
  }
}

export function extractProjectName(sessionFilePath: string): string {
  const projectDir = path.dirname(sessionFilePath);
  const projectHash = path.basename(projectDir);

  const parts = projectHash.split("-").filter((p) => p.length > 0);

  let startIndex = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].toLowerCase() === "users" || i < 2) {
      startIndex = i + 1;
    } else {
      break;
    }
  }

  const projectParts = parts.slice(startIndex);
  if (projectParts.length === 0) {
    return "default";
  }

  return projectParts.join("-").toLowerCase() || "default";
}

export function findSessionFiles(projectPath?: string): string[] {
  const claudeDir = projectPath || path.join(os.homedir(), ".claude", "projects");

  if (!fs.existsSync(claudeDir)) {
    return [];
  }

  // Load existing index
  const index = loadScanIndex();
  const sessionFiles: { path: string; mtime: Date }[] = [];
  const newIndex: ScanIndex = { files: {}, lastScan: Date.now() };

  function searchDir(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip subagents directory
        if (entry.name === "subagents") {
          continue;
        }

        if (entry.isDirectory()) {
          searchDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
          const stats = fs.statSync(fullPath);
          const mtime = stats.mtime.getTime();
          const size = stats.size;

          // Update new index
          newIndex.files[fullPath] = { mtime, size };

          // Check if file has changed since last scan
          const cached = index.files[fullPath];
          const hasChanged = !cached || cached.mtime !== mtime || cached.size !== size;

          // Only include files that changed AND are recent AND larger than 1KB
          const sixtyMinutesAgo = Date.now() - 60 * 60 * 1000;
          if (hasChanged && mtime > sixtyMinutesAgo && size > 1000) {
            sessionFiles.push({ path: fullPath, mtime: stats.mtime });
          }
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  searchDir(claudeDir);

  // Save updated index
  saveScanIndex(newIndex);

  // Sort by modification time, newest first
  sessionFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return sessionFiles.map((f) => f.path);
}

export function getRecentSessions(limit = 5): ClaudeSession[] {
  const files = findSessionFiles();
  const sessions: ClaudeSession[] = [];

  for (const filePath of files.slice(0, limit)) {
    const messages = parseSessionFile(filePath);
    if (messages.length > 0) {
      const stats = fs.statSync(filePath);
      sessions.push({
        filePath,
        projectName: extractProjectName(filePath),
        messages,
        lastModified: stats.mtime,
      });
    }
  }

  return sessions;
}

export function getTodayMessages(messages: ClaudeMessage[]): ClaudeMessage[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  return messages.filter((msg) => {
    if (!msg.timestamp) return true; // Include messages without timestamp
    return msg.timestamp >= todayISO;
  });
}

const INDEX_FILE = ".claude-scan-index.json";

function getIndexPath(): string {
  return path.join(os.homedir(), ".claude", INDEX_FILE);
}

export function loadScanIndex(): ScanIndex {
  try {
    const indexPath = getIndexPath();
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, "utf-8");
      return JSON.parse(content);
    }
  } catch {
    // Ignore errors, return empty index
  }
  return { files: {}, lastScan: 0 };
}

export function saveScanIndex(index: ScanIndex): void {
  try {
    const indexPath = getIndexPath();
    index.lastScan = Date.now();
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  } catch {
    // Ignore errors
  }
}
