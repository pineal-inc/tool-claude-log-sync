# Claude Log Sync

Claude Codeの会話をMarkdownファイルにエクスポートするCLIツール。

## インストール

```bash
# クローンしてインストール
git clone https://github.com/pineal-inc/claude-log-sync.git
cd claude-log-sync
npm install
npm run build

# グローバルインストール
npm install -g .
```

## 使い方

```bash
# 基本的な使い方
claude-log-sync ~/logs/claude

# 特定のプロジェクトを指定
claude-log-sync ~/logs/claude --project ~/.claude/projects/my-project

# 自動gitコミットを無効化
claude-log-sync ~/logs/claude --no-git
```

### オプション

| オプション | 説明 |
|--------|-------------|
| `-o, --output <path>` | Markdownファイルの出力先ディレクトリ |
| `-p, --project <path>` | 特定のClaude Codeプロジェクトへのパス |
| `--no-git` | 同期後の自動gitコミットを無効化 |
| `-h, --help` | ヘルプメッセージを表示 |

## 仕組み

1. `~/.claude/projects/` 配下のアクティブなセッションファイルを監視
2. JSONLセッションファイルを解析し、ユーザーとアシスタントのメッセージを抽出
3. システムメッセージやノイズをフィルタリング
4. 会話を日付別のMarkdownファイルとして保存（例: `2026年1月14日.md`）
5. オプションでgitにコミット

### インクリメンタルインデックス

ファイル数が増えても効率的にスキャンできるよう、インデックス機能を搭載:

- `~/.claude/.claude-scan-index.json` にファイルのmtime/sizeを記録
- 前回スキャン時から変更がないファイルはスキップ
- ファイル数が数千になっても高速に動作

## 出力形式

```markdown
# 2026年1月14日 Claudeとの会話

**ユーザー**: こんにちは、Claude!

**Claude**: こんにちは！何かお手伝いできることはありますか？
```

## 自動実行

launchdを使って定期実行できます:

```xml
<!-- ~/Library/LaunchAgents/com.pineal.claude-log-sync.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pineal.claude-log-sync</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/node</string>
        <string>/path/to/claude-log-sync/dist/index.js</string>
        <string>/path/to/output</string>
        <string>--no-git</string>
    </array>
    <key>StartInterval</key>
    <integer>60</integer>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

```bash
# launchdに登録
launchctl load ~/Library/LaunchAgents/com.pineal.claude-log-sync.plist
```

## クレジット

[栗林健太郎氏の記事](https://zenn.dev/kentaro/articles/claude-code-obsidian-sync)にインスパイアされて作成。

## ライセンス

MIT
