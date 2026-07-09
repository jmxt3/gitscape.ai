#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const MCP_URL = 'https://gitscape.ai/api/mcp';

// ─── IDE detection table ───────────────────────────────────────────────────────
// Each entry describes where to find the IDE's config and what key to use.
// "url"       → Claude, Cursor, VS Code Continue, IntelliJ, Zed
// "serverUrl" → Windsurf, Antigravity (Gemini IDE)

const IDE_TARGETS = [
  {
    id: 'antigravity',
    label: 'Antigravity (Gemini IDE)',
    urlKey: 'serverUrl',
    // Global config — relative to HOME
    configPath: (home) => path.join(home, '.gemini', 'config', 'mcp_config.json'),
    isGlobal: true,
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    urlKey: 'serverUrl',
    configPath: (home) => path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
    isGlobal: true,
  },
  {
    id: 'cursor',
    label: 'Cursor',
    urlKey: 'url',
    // Project-local config
    configPath: () => path.join(process.cwd(), '.cursor', 'mcp.json'),
    isGlobal: false,
  },
  {
    id: 'claude',
    label: 'Claude (Code / Desktop)',
    urlKey: 'url',
    configPath: () => path.join(process.cwd(), '.mcp.json'),
    isGlobal: false,
  },
];

function getHomeDir() {
  return process.env.HOME || process.env.USERPROFILE || (process.platform === 'win32'
    ? path.join(process.env.HOMEDRIVE || 'C:', process.env.HOMEPATH || '\\Users\\default')
    : '/tmp');
}

/**
 * Detect which IDEs are present by checking whether their config directories exist.
 * For global IDEs (Windsurf, Antigravity) we check the parent directory.
 * For project-local IDEs (Cursor, Claude) we always write them if asked.
 */
function detectIDEs(home) {
  const detected = [];
  for (const ide of IDE_TARGETS) {
    const cfgPath = ide.configPath(home);
    const parentDir = path.dirname(cfgPath);
    if (ide.isGlobal) {
      // Only write global configs if the IDE is actually installed (parent dir exists)
      if (fs.existsSync(parentDir)) {
        detected.push(ide);
      }
    } else {
      // Project-local — always include
      detected.push(ide);
    }
  }
  return detected;
}

/**
 * Merge the gitscape entry into an existing MCP config JSON object.
 * Preserves all other servers already configured.
 */
function mergeGitscapeEntry(existing, urlKey) {
  const parsed = existing ? (() => { try { return JSON.parse(existing); } catch { return {}; } })() : {};
  const servers = parsed.mcpServers || {};
  servers.gitscape = { [urlKey]: MCP_URL };
  return JSON.stringify({ ...parsed, mcpServers: servers }, null, 2);
}

async function handleInit() {
  const home = getHomeDir();
  const targets = detectIDEs(home);

  if (targets.length === 0) {
    // Fallback: write a generic .mcp.json in the project root
    const fallbackPath = path.join(process.cwd(), '.mcp.json');
    const content = JSON.stringify({ mcpServers: { gitscape: { url: MCP_URL } } }, null, 2);
    fs.writeFileSync(fallbackPath, content, 'utf-8');
    console.log(`✓ Created .mcp.json → ${MCP_URL}`);
    console.log('  (No supported IDE detected — wrote generic config)');
    return;
  }

  let wrote = 0;
  for (const ide of targets) {
    const cfgPath = ide.configPath(home);
    const dir = path.dirname(cfgPath);

    try {
      // Ensure parent directory exists
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Read existing config (if any) and merge
      const existing = fs.existsSync(cfgPath) ? fs.readFileSync(cfgPath, 'utf-8') : null;
      const merged = mergeGitscapeEntry(existing, ide.urlKey);
      fs.writeFileSync(cfgPath, merged, 'utf-8');

      const displayPath = cfgPath.replace(home, '~');
      console.log(`✓ ${ide.label}: wrote "${ide.urlKey}" → ${displayPath}`);
      wrote++;
    } catch (err) {
      console.warn(`  ⚠ Could not update ${ide.label} config: ${err.message}`);
    }
  }

  console.log(`\n${wrote} IDE config${wrote === 1 ? '' : 's'} updated. Reload your IDE to pick up the change.`);
  console.log('  Private repo? Pass your PAT when asking: "install using token ghp_..."');
}



function printHelp() {
  console.log(`
GitScape CLI — Compile any repository into a local agent skill.

Usage:
  npx gitscape <repo_url> [options]   Compile and install a skill locally
  npx gitscape init                   Configure your IDE(s) to use the GitScape MCP server
  npx gitscape remove <skill_name>    Uninstall a skill and clean up references

Options:
  --token <pat>       Optional GitHub Personal Access Token for private repos
  -h, --help          Show this help message
`);
}

async function handleRemove(skillName) {
  let name = skillName.trim();
  if (name.startsWith('http://') || name.startsWith('https://')) {
    try {
      const urlParts = new URL(name).pathname.split('/');
      name = urlParts[urlParts.length - 1];
      if (name.endsWith('.git')) name = name.slice(0, -4);
    } catch (e) {
      // fallback
    }
  }

  const skillDir = path.join(process.cwd(), '.agents', 'skills', name);
  console.log(`Removing skill ${name}...`);

  if (fs.existsSync(skillDir)) {
    try {
      fs.rmSync(skillDir, { recursive: true, force: true });
      console.log(`✓ Deleted directory .agents/skills/${name}`);
    } catch (err) {
      console.error(`Error deleting directory: ${err.message}`);
    }
  } else {
    console.log(`Note: Directory .agents/skills/${name} did not exist.`);
  }

  const targetFiles = ['AGENTS.md', '.agents/AGENTS.md', 'CLAUDE.md', '.gemini/config/AGENTS.md'];
  const skillLine = `- [${name}](.agents/skills/${name}/SKILL.md)`;
  const escapedLine = skillLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const filename of targetFiles) {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) continue;

    try {
      let content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes(skillLine)) {
        content = content.replace(new RegExp(`\\n?\\s*${escapedLine}\\s*\\n?`, 'g'), '\n');
        
        // Cleanup empty GitScape Skills section
        const marker = '## GitScape Skills';
        if (content.includes(marker)) {
          const parts = content.split(marker);
          const afterMarker = parts[1].trim();
          if (!afterMarker || afterMarker.startsWith('#') || !afterMarker.includes('- [')) {
            content = parts[0].trim() + '\n\n' + afterMarker;
          }
        }

        fs.writeFileSync(filePath, content.trim() + '\n', 'utf-8');
        console.log(`✓ Removed reference from ${filename}`);
      }
    } catch (err) {
      console.warn(`Warning: Could not update ${filename}: ${err.message}`);
    }
  }

  console.log(`✓ Skill ${name} completely uninstalled.`);
}


// Helper to inject a skill into AGENTS.md/CLAUDE.md idempotently
function injectIntoAgentsMd(skillName) {
  const targetFiles = ['AGENTS.md', '.agents/AGENTS.md', 'CLAUDE.md', '.gemini/config/AGENTS.md'];
  
  for (const filename of targetFiles) {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) continue;

    try {
      let content = fs.readFileSync(filePath, 'utf-8');
      const marker = '## GitScape Skills';
      const skillLine = `- [${skillName}](.agents/skills/${skillName}/SKILL.md)`;

      if (content.includes(skillLine)) {
        // Already injected
        continue;
      }

      if (content.includes(marker)) {
        // Section exists, append to it
        const parts = content.split(marker);
        const afterMarker = parts[1];
        const nextHeadingIndex = afterMarker.search(/\n#[#\s]/);
        if (nextHeadingIndex !== -1) {
          const sectionContent = afterMarker.substring(0, nextHeadingIndex).trim();
          const rest = afterMarker.substring(nextHeadingIndex);
          const updatedSection = sectionContent ? `${sectionContent}\n${skillLine}` : `${skillLine}`;
          content = `${parts[0]}${marker}\n${updatedSection}\n${rest}`;
        } else {
          content = `${parts[0]}${marker}\n${afterMarker.trim()}\n${skillLine}\n`;
        }
      } else {
        // Section doesn't exist, append to end of file
        content = `${content.trim()}\n\n${marker}\n${skillLine}\n`;
      }

      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`✓ Registered ${skillName} in ${filename}`);
    } catch (err) {
      console.warn(`Warning: Could not update ${filename}: ${err.message}`);
    }
  }
}

async function handleCompile(repoUrl, options) {
  const token = options.token || process.env.GITHUB_TOKEN || null;

  console.log(`Compiling skill for ${repoUrl}...`);

  // Support local dev override via env var
  const serverBase = process.env.GITSCAPE_SERVER || 'https://gitscape.ai';
  const isLocal = serverBase.includes('localhost') || serverBase.includes('127.0.0.1');
  const mcpCallUrl = isLocal ? `${serverBase}/mcp/call` : `${serverBase}/api/mcp/call`;
  
  try {
    const response = await fetch(mcpCallUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'install_skill',
        arguments: {
          repo_url: repoUrl,
          github_token: token,
          skill_type: 'framework'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}: ${await response.text()}`);
    }

    const resData = await response.json();
    if (resData.isError) {
      const errMsg = resData.content?.[0]?.text || 'Unknown error';
      throw new Error(errMsg);
    }

    const payloadText = resData.content?.[0]?.text;
    if (!payloadText) {
      throw new Error('Empty payload returned from server');
    }

    const payload = JSON.parse(payloadText);
    if (payload.status !== 'success') {
      throw new Error(payload.message || 'Failed to generate skill');
    }

    const { skill_name, scan_grade, files } = payload;

    console.log(`✓ Skill compiled successfully (Scan Grade: ${scan_grade})`);
    console.log('Writing files locally...');

    for (const [relPath, content] of Object.entries(files)) {
      const fullPath = path.join(process.cwd(), relPath);
      const dir = path.dirname(fullPath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(fullPath, content, 'utf-8');
      console.log(`  write ${relPath}`);
    }

    console.log(`✓ Skill ${skill_name} installed to .agents/skills/${skill_name}`);
    
    // Inject references into AGENTS.md etc.
    injectIntoAgentsMd(skill_name);

  } catch (err) {
    console.error(`Error compiling skill: ${err.message}`);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  // Option parsing
  const options = {};
  const cleanArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--token' && i + 1 < args.length) {
      options.token = args[++i];


    } else if (args[i].startsWith('--')) {
      console.warn(`Warning: Unknown option ignored: ${args[i]}`);
    } else {
      cleanArgs.push(args[i]);
    }
  }

  if (cleanArgs[0] === 'init') {
    await handleInit(options);
    process.exit(0);
  }

  if (cleanArgs[0] === 'remove' || cleanArgs[0] === 'uninstall') {
    const targetSkill = cleanArgs[1];
    if (!targetSkill) {
      console.error('Error: Please specify the name of the skill to remove.');
      process.exit(1);
    }
    await handleRemove(targetSkill);
    process.exit(0);
  }

  const repoUrl = cleanArgs[0];
  if (!repoUrl || (!repoUrl.startsWith('http://') && !repoUrl.startsWith('https://') && !repoUrl.includes('git@'))) {
    console.error(`Error: Invalid target repository URL: ${repoUrl}`);
    printHelp();
    process.exit(1);
  }

  await handleCompile(repoUrl, options);
}

main();
