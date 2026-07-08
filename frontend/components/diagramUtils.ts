// Author: Joao Machete
// Description: Utility functions for transforming a GitHub file tree into a D3-compatible hierarchical structure for visualizations such as file explorer diagrams. Handles conversion of flat GitHub API file lists into nested directory/file nodes, including value sizing for visualization.

import { GithubFile, RawDiagramNode, GithubTreeItem } from '../types'; // Assuming GithubFile is compatible with GithubTreeItem

export function transformGithubTreeToD3Hierarchy(
  treeItems: GithubFile[], // Using GithubFile directly, assuming it's compatible with GithubTreeItem structure needed
  repoDisplayName: string // e.g. "owner/repo"
): RawDiagramNode {
  const root: RawDiagramNode = {
    id: 'ROOT', // Unique ID for the root
    name: repoDisplayName.includes('/') ? repoDisplayName.substring(repoDisplayName.indexOf('/') + 1) : repoDisplayName, // Use repo name part
    type: 'directory',
    path: '', // Root path is empty
    children: [],
  };

  const nodeMap: Map<string, RawDiagramNode> = new Map();
  nodeMap.set('', root); // Map root by its empty path

  // Sort items by path to help ensure parent directories are generally processed before their children.
  const sortedItems = [...treeItems].sort((a, b) => a.path.localeCompare(b.path));

  for (const item of sortedItems) {
    const pathParts = item.path.split('/');
    let currentParentNode = root;
    let currentPathAccumulated = '';

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      // Update accumulated path for the current part
      const newAccumulatedPath = currentPathAccumulated ? `${currentPathAccumulated}/${part}` : part;

      let childNode = nodeMap.get(newAccumulatedPath);

      if (!childNode) {
        // Node doesn't exist, create it.
        // If it's the last part of the path, it's the item itself. Otherwise, it's an intermediate directory.
        const isActualItem = i === pathParts.length - 1;
        // Determine node type: if it's the full path of the item, use item.type, otherwise it's a directory.
        const nodeType = isActualItem ? (item.type === 'blob' ? 'file' : 'directory') : 'directory';

        childNode = {
          id: newAccumulatedPath, // Use full path as a unique ID
          name: part,
          type: nodeType,
          path: newAccumulatedPath,
          data: isActualItem ? (item as unknown as GithubTreeItem) : undefined, // Store original item data for the actual item
          children: nodeType === 'directory' ? [] : undefined,
          value: (nodeType === 'file' && item.size) ? item.size : (nodeType === 'directory' ? 1000 : 100) // Example value
        };

        if (!currentParentNode.children) {
          currentParentNode.children = []; // Ensure parent has a children array
        }
        currentParentNode.children.push(childNode);
        nodeMap.set(newAccumulatedPath, childNode);
      } else {
        // Node already exists (e.g., created as an intermediate directory).
        // If this is the actual item and it's a directory, ensure it has children array.
        if (childNode.type === 'directory' && !childNode.children) {
          childNode.children = [];
        }
        // If this is the actual item, update its data (e.g. if it was an implicit dir and now we have explicit tree item)
        if (i === pathParts.length - 1) {
            childNode.data = (item as unknown as GithubTreeItem); // Store/update original item data
            childNode.type = item.type === 'blob' ? 'file' : 'directory'; // Correct type if it was implicit
            if (item.type === 'blob' && item.size) childNode.value = item.size;
        }
      }
      currentPathAccumulated = newAccumulatedPath; // Update for next iteration
      currentParentNode = childNode; // Move to the child for the next path part

      // If currentParentNode became a file somehow (error in logic or data), and it's not the last part, warn and break.
      if (currentParentNode.type === 'file' && i < pathParts.length -1) {
        console.warn("Data inconsistency: file found in intermediate path", currentParentNode.path);
        break;
      }
    }
  }
  return root;
}
