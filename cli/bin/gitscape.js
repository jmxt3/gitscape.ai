#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const DEFAULT_SERVER = process.env.GITSCAPE_SERVER_URL || 'https://gitscape-410919026990.us-central1.run.app';

function printHelp() {
  console.log(`
GitScape CLI — Compile any repository into a local agent skill.

Usage:
  npx gitscape <repo_url> [options]   Compile and install a skill locally
  npx gitscape init                   Create a local .mcp.json pointing to GitScape

Options:
  --token <pat>       Optional GitHub Personal Access Token for private repos
  --type <type>       Skill type: 'code' or 'framework' (default: 'code')
  --server <url>      Override GitScape server URL
  -h, --help          Show this help message
`);
}

async function handleInit(options = {}) {
  const server = options.server || DEFAULT_SERVER;
  const mcpConfigPath = path.join(process.cwd(), '.mcp.json');
  const config = {
    mcpServers: {
      gitscape: {
        url: `${server}/api/mcp`,
        description: "GitScape — compile any repo into an agent skill"
      }
    }
  };

  try {
    fs.writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`✓ Created .mcp.json pointing to ${server}/api/mcp`);
    console.log('\nTo enable this MCP server in Cursor or Claude Code, add the server in your editor settings.');
  } catch (err) {
    console.error(`Error writing .mcp.json: ${err.message}`);
    process.exit(1);
  }
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
  const server = options.server || DEFAULT_SERVER;
  const token = options.token || process.env.GITHUB_TOKEN || null;
  const type = options.type || 'code';

  console.log(`Compiling skill for ${repoUrl}...`);
  
  const isDirectLocal = server.includes(':8081') || server.includes('127.0.0.1:8081') || server.includes('localhost:8081');
  const mcpCallUrl = isDirectLocal ? `${server}/mcp/call` : `${server}/api/mcp/call`;
  
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
          skill_type: type
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
    } else if (args[i] === '--type' && i + 1 < args.length) {
      options.type = args[++i];
    } else if (args[i] === '--server' && i + 1 < args.length) {
      options.server = args[++i];
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

  const repoUrl = cleanArgs[0];
  if (!repoUrl || (!repoUrl.startsWith('http://') && !repoUrl.startsWith('https://') && !repoUrl.includes('git@'))) {
    console.error(`Error: Invalid target repository URL: ${repoUrl}`);
    printHelp();
    process.exit(1);
  }

  await handleCompile(repoUrl, options);
}

main();
