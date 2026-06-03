# VAN MCP Server

Connects VAN to Claude (Cowork).

## Setup

1. Right-click **`setup.ps1`** → **Run with PowerShell**
2. Restart Claude Desktop
3. Ask Claude: *"Log me in to VAN"*

That's it. The script handles Node detection, dependencies, building, and configuring Claude Desktop automatically.

## Requirements

- Node.js v18 or higher — [nodejs.org](https://nodejs.org)
- Claude Desktop (Cowork)

## Troubleshooting

**"Cannot be loaded because running scripts is disabled"**
Open PowerShell as Administrator and run:
```
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Then re-run the setup script.

**MCP server shows "failed" in Claude Desktop**
- Make sure you restarted Claude Desktop after running setup
- Re-run `setup.ps1` to regenerate the config

**SSL / certificate errors**
The dev server uses a self-signed certificate. The setup script sets
`NODE_TLS_REJECT_UNAUTHORIZED=0` automatically for the MCP server.
This is safe for internal dev use only.
