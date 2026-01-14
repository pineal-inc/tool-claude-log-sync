# Claude Log Sync

CLI tool to export Claude Code conversations to Markdown files.

## Installation

```bash
# Clone and install
git clone https://github.com/your-username/claude-log-sync.git
cd claude-log-sync
npm install
npm run build

# Or install globally
npm install -g .
```

## Usage

```bash
# Basic usage
claude-log-sync ~/logs/claude

# With specific project
claude-log-sync ~/logs/claude --project ~/.claude/projects/my-project

# Without auto git commit
claude-log-sync ~/logs/claude --no-git
```

### Options

| Option | Description |
|--------|-------------|
| `-o, --output <path>` | Output directory for markdown files |
| `-p, --project <path>` | Path to specific Claude Code project directory |
| `--no-git` | Disable automatic git commit after sync |
| `-h, --help` | Show help message |

## How It Works

1. Monitors `~/.claude/projects/` for active session files
2. Parses JSONL session files to extract user and assistant messages
3. Filters out system messages and noise
4. Saves conversations as daily markdown files (e.g., `2026年1月14日.md`)
5. Optionally commits changes to git

## Output Format

```markdown
# 2026年1月14日 Claudeとの会話

**ユーザー**: Hello, Claude!

**Claude**: Hello! How can I help you today?
```

## Automation

You can set up a cron job or launchd to run this periodically:

```bash
# Run every minute (crontab -e)
* * * * * /path/to/claude-log-sync ~/logs/claude
```

## Credits

Inspired by [栗林健太郎's article](https://zenn.dev/kentaro/articles/claude-code-obsidian-sync) on syncing Claude Code conversations.

## License

MIT
