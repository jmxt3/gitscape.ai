// Author: Joao Machete
// Description: Centralized application constants for API endpoints, file extension filters, ignored paths, file size limits, model configuration, localStorage keys, and documentation URLs. Used throughout the app for configuration and validation.

export const GITHUB_API_BASE_URL = 'https://api.github.com';

export const RELEVANT_EXTENSIONS: string[] = [
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cs', '.go', '.rb', '.php', '.swift', '.kt', '.kts',
  '.c', '.cpp', '.h', '.hpp',
  '.html', '.htm', '.css', '.scss', '.less', '.json', '.xml', '.yaml', '.yml',
  '.md', '.txt', '.sh', 'dockerfile', '.env', '.config', '.ini', '.toml',
  'readme', // for files named README without extension
];

// Common paths to ignore
export const IGNORED_PATHS_REGEX: RegExp[] = [
  /(^|\/)node_modules\//,
  /(^|\/)\.git\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)coverage\//,
  /(^|\/)vendor\//,
  /(^|\/)target\//, // Java/Rust target folder
  /(^|\/)\.vscode\//,
  /(^|\/)\.idea\//,
  /\.min\.(js|css)$/, // Minified files
  /\.(lock|sum)$/, // Lock files like package-lock.json, yarn.lock, go.sum
  /\.(png|jpe?g|gif|bmp|webp|svg|ico|woff2?|ttf|otf|eot)$/i, // Binary image/font files by extension
  /\.(mp3|mp4|webm|ogg|wav)$/i, // Media files
  /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i, // Document files
  /\.(zip|tar|gz|rar|7z)$/i, // Archive files
  /\.(exe|dll|so|dylib|jar|bin|img|iso)$/i, // Binary executables/libraries
];


export const MAX_FILES_TO_PROCESS = 100; // Limit the number of files to process
export const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per file
export const MAX_TOTAL_SIZE_BYTES = 5 * 1024 * 1024; // 5MB total for all files



export const URL_CONVERSION_TARGET_DOMAIN = 'gitscape.ai';

// LocalStorage Keys
export const GITHUB_TOKEN_LOCAL_STORAGE_KEY = 'githubApiToken';
export const REPO_URL_LOCAL_STORAGE_KEY = 'gitScapeRepoUrl';
export const DIGEST_CONTENT_LOCAL_STORAGE_KEY = 'gitScapeDigestContent'; // Kept for reference, but not primary use for full digest
export const CACHED_OUTPUT_PREFIX = 'gitScapeCachedOutput_';
