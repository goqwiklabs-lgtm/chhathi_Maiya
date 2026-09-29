# Antigravity (`agy`) Auto-Approve & Permissions System

This document explains how Google Antigravity (`agy`) manages tool permissions, how the auto-approve system works under the hood, and how you can configure it so you do not have to repeatedly press **Allow** during agent workflows.

---

## 1. Overview & Security Model

By default, **Google Antigravity (`agy`)** operates under a guarded execution model:
* Whenever the agent attempts to run a terminal command, edit files, or execute external tools (like MCP servers or web browsing), it pauses and requests explicit confirmation (`Allow` or `Deny`).
* This safeguard prevents unintended modifications to your environment or repository.
* However, in trusted development workspaces (such as devcontainers, GitHub Codespaces, or dedicated VMs), repetitive approval prompts can interrupt autonomous development.

Antigravity provides a multi-tiered approval system allowing you to transition smoothly from full manual confirmation to **complete autonomous auto-approval**.

---

## 2. The Four Tool Execution Policies

Antigravity defines four tool execution policies governing how command approvals are handled:

| Policy Mode | Behavior | When to Use |
| :--- | :--- | :--- |
| `always-proceed` | **Full Auto-Approve**: Auto-approves terminal commands, file edits, and tool actions without waiting for user confirmation. | Recommended for trusted environments, containers, and hands-off autonomous coding. |
| `proceed-in-sandbox` | Auto-approves commands that execute safely within the container/sandbox, requesting manual review only when a command attempts to escape sandbox boundaries. | Balanced security for mixed-trust environments. |
| `request-review` *(Default)* | Displays every proposed command and file edit, waiting for manual confirmation before execution. | Safe standard mode for unvetted tasks or shared production environments. |
| `strict` | Requires explicit approval for all operations, including read-only queries and inspection tools. | High-security environments with strict compliance requirements. |

---

## 3. How to Enable Auto-Approve

There are three primary ways to enable auto-approval in `agy`:

### Method A: Permanent Global Settings (`settings.json`) — *Already Configured*

The persistent configuration file is located at:
`~/.gemini/antigravity-cli/settings.json`

Setting `"toolPermission": "always-proceed"` instructs `agy` to run all commands and tool calls automatically:

```json
{
  "toolPermission": "always-proceed",
  "trustedWorkspaces": [
    "/workspaces/chhathi_Maiya"
  ],
  "permissions": {
    "allow": [
      "command(agy)",
      "command(bash)",
      "command(cat)",
      "command(git)",
      "command(ls)",
      "command(node)",
      "command(npm)",
      "command(python3)",
      "command(sh)"
    ]
  }
}
```

> [!NOTE]
> We have already configured this file on your system with `"toolPermission": "always-proceed"` and seeded the allowlist with standard development commands.

---

### Method B: CLI Startup Flags

When starting a session from the terminal, you can bypass all permission prompts using CLI flags:

1. **Auto-Approve Everything**:
   ```bash
   agy --dangerously-skip-permissions
   ```
   * Flag: `--dangerously-skip-permissions`
   * Effect: Suppresses all confirmation prompts for tools, commands, and subagents.

2. **Auto-Approve File Edits Only**:
   ```bash
   agy --mode accept-edits
   ```
   * Mode: `accept-edits`
   * Effect: Automatically approves file writes and patch applications, while still prompting before shell command executions.

3. **Combined for Full Autonomous Execution**:
   ```bash
   agy --dangerously-skip-permissions --mode accept-edits
   ```

---

### Method C: In-Session Controls & Hotkeys

If you are already inside an interactive `agy` session, you can adjust permissions on the fly:

1. **`Shift + Tab` (Mode Switching)**:
   * Press `Shift + Tab` in the CLI input box to cycle through modes:
     * `default` (Standard confirmation prompts)
     * `accept-edits` (Auto-approves code modifications)
     * `plan` (Read-only research and planning mode)

2. **`/permissions` Slash Command**:
   * Type `/permissions` and press Enter to view active permission grants, add new binary rules, or inspect granted patterns.

3. **`/settings` Slash Command**:
   * Type `/settings` inside the CLI to open the interactive configuration panel and adjust the **Tool Execution Policy** directly.

---

## 4. Permission Grants Architecture

When you approve a command during a turn, `agy`'s internal `PermissionGrantStore` records that grant so you are not asked again for identical patterns:

* **Prefix & Word Anchoring**: Grants are checked using anchored regex patterns (`^(?:pattern)$`).
* **Format of Grants**:
  * Shell commands: `command(<binary> <subcommand>)` (e.g., `command(git status)`, `command(npm test)`)
  * File reads: `read_file(<absolute_path>)`
  * File writes: `write_file(<absolute_path>)`
  * MCP server tools: `mcp(<server_name>/*)`

---

## 5. Summary of Current Configuration

Your workspace has been set up with the following:

1. **`toolPermission` set to `always-proceed`**: `agy` will execute tool calls and terminal commands autonomously.
2. **`permissions.allow` updated**: Core binaries (`git`, `bash`, `python3`, `node`, `npm`, `cat`, `ls`, etc.) are pre-approved in `~/.gemini/antigravity-cli/settings.json`.
3. **Workspace Trust enabled**: `/workspaces/chhathi_Maiya` is marked as a trusted directory.
