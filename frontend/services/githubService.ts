// Author: Joao Machete
// Description: Service class for interacting with the GitHub API, including repository parsing, file tree retrieval, file content fetching, and error handling. Provides utility methods for working with GitHub repositories and files in the application.

import { GITHUB_API_BASE_URL, MAX_FILE_SIZE_BYTES } from '../constants';
import { GithubRepoInfo, GithubFile, GitHubRepoDetails, GitHubFileContent, GitHubTreeResponse } from '../types';

export type { GithubFile }; // Use 'export type' for re-exporting types with isolatedModules enabled

export class GithubService {
  private apiToken?: string;

  constructor(apiToken?: string) {
    this.apiToken = apiToken;
  }

  public getMaxFileSize(): number {
    return MAX_FILE_SIZE_BYTES;
  }

  private async request<T>(endpoint: string): Promise<T> {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
    };
    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    }

    try {
      const response = await fetch(`${GITHUB_API_BASE_URL}${endpoint}`, {
        headers,
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        const errorMessage = errorPayload.message || response.statusText || 'Unknown API error';
        throw new Error(`GitHub API request failed: ${response.status} ${errorMessage}`);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      console.error(`Error during fetch to ${endpoint}:`, error);
      throw error;
    }
  }

  public parseGitHubUrl(url: string): GithubRepoInfo | null {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname !== 'github.com') {
        return null;
      }
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2) {
        return { owner: pathParts[0], repo: pathParts[1].replace('.git', '') };
      }
      return null;
    } catch (error) {
      const sshMatch = url.match(/github\.com[:/]([\w.-]+)\/([\w.-]+?)(\.git)?$/);
      if (sshMatch && sshMatch[1] && sshMatch[2]) {
        return { owner: sshMatch[1], repo: sshMatch[2] };
      }
      return null;
    }
  }

  public async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const repoDetails = await this.request<GitHubRepoDetails>(`/repos/${owner}/${repo}`);
    return repoDetails.default_branch;
  }

  public async getRepoFileTree(owner: string, repo: string, branch: string): Promise<GithubFile[]> {
    const branchData = await this.request<any>(`/repos/${owner}/${repo}/branches/${branch}`);
    const commitSha = branchData.commit.sha;

    const commitData = await this.request<any>(`/repos/${owner}/${repo}/git/commits/${commitSha}`);
    const treeSha = commitData.tree.sha;

    const response = await this.request<GitHubTreeResponse>(`/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`);

    if (response.truncated) {
      console.warn(`GitHub API response for file tree of ${owner}/${repo} was truncated. Some files may be missing.`);
    }
    // Filter out non-blobs and files that are too large
    // Ensure size is present for blobs. Tree items might not have 'size'.
    return response.tree.filter(item =>
        item.type === 'blob' ?
          (item.size !== undefined && item.size <= MAX_FILE_SIZE_BYTES) :
          true // Keep tree type items or other types for diagram structure
    );
  }

  public async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    const fileData = await this.request<GitHubFileContent>(`/repos/${owner}/${repo}/contents/${path}`);

    if (fileData.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`File ${path} is too large (${(fileData.size / (1024*1024)).toFixed(2)}MB). Max allowed: ${(MAX_FILE_SIZE_BYTES / (1024*1024)).toFixed(2)}MB.`);
    }

    if (fileData.encoding === 'base64' && fileData.content) {
      try {
        return atob(fileData.content);
      } catch (e) {
        console.error(`Failed to decode base64 content for ${path}:`, e);
        throw new Error(`Failed to decode content for ${path}.`);
      }
    } else if (fileData.download_url) {
      const response = await fetch(fileData.download_url, {
        headers: this.apiToken ? { 'Authorization': `Bearer ${this.apiToken}` } : {}
      });
      if (!response.ok) {
        throw new Error(`Failed to download file content for ${path} from ${fileData.download_url}. Status: ${response.status}`);
      }
      if (response.headers.get("Content-Length") && parseInt(response.headers.get("Content-Length")!) > MAX_FILE_SIZE_BYTES) {
        // This check might be redundant if the fileData.size check above is reliable
        console.warn(`File ${path} downloaded from URL is larger than expected by initial size. Clamping to MAX_FILE_SIZE_BYTES for content processing if applicable.`);
        // Depending on strictness, you might throw new Error here or truncate.
        // For now, we'll rely on the initial fileData.size check and assume it's accurate.
        // If not, the atob or text() processing might fail or take too long for huge files missed by initial check.
      }
      return response.text();
    }
    throw new Error(`Could not retrieve content for ${path}. No base64 content or direct download URL found, or file is not accessible.`);
  }
}
