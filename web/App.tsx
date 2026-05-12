import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { Header } from "./components/Header";
import { RepoInput } from "./components/RepoInput";
import { GithubTokenModal } from "./components/GithubTokenModal";
import { GithubService, GithubFile } from "./services/githubService";
import { OutputTabs } from "./components/OutputTabs";
import { transformGithubTreeToD3Hierarchy } from "./components/diagramUtils";
import { DiagramFullscreenModal } from "./components/DiagramFullscreenModal";
import {
  GITHUB_TOKEN_LOCAL_STORAGE_KEY,
  REPO_URL_LOCAL_STORAGE_KEY,
  CACHED_OUTPUT_PREFIX,
} from "./constants";
import { RawDiagramNode, CachedRepoOutput, SkillManifest } from "./types";

// Helper to safely get items from localStorage
const getFromLocalStorage = (key: string, defaultValue: string): string => {
  try {
    return localStorage.getItem(key) || defaultValue;
  } catch (e) {
    console.warn(`Failed to read '${key}' from localStorage:`, e);
    return defaultValue;
  }
};

// Helper to safely set or remove items in localStorage
const storeInLocalStorage = (key: string, value: string | null) => {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch (e) {
    console.warn(`Failed to write '${key}' to localStorage:`, e);
  }
};

const App: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState<string>(() =>
    getFromLocalStorage(REPO_URL_LOCAL_STORAGE_KEY, "")
  );
  const [digest, setDigest] = useState<string>("");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);

  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [showTokenModal, setShowTokenModal] = useState<boolean>(false);

  const [processedRepoName, setProcessedRepoName] = useState<
    string | undefined
  >(undefined);
  const [repoNameForFilename, setRepoNameForFilename] = useState<string | null>(
    null
  );
  const [currentDefaultBranch, setCurrentDefaultBranch] = useState<
    string | null
  >(null);
  const [filesToRenderInDiagram, setFilesToRenderInDiagram] = useState<
    GithubFile[]
  >([]);

  // Skill export state
  const [skillMd, setSkillMd] = useState<string>("");
  const [manifestJson, setManifestJson] = useState<SkillManifest | null>(null);

  const [showDiagramFullscreenModal, setShowDiagramFullscreenModal] =
    useState<boolean>(false);
  const [diagramDataForModal, setDiagramDataForModal] =
    useState<RawDiagramNode | null>(null);
  const [repoNameForModal, setRepoNameForModal] = useState<string | undefined>(
    undefined
  );
  const [defaultBranchForModal, setDefaultBranchForModal] = useState<
    string | null
  >(null);


  const currentRepoInfoRef = useRef<{ owner: string; repo: string } | null>(
    null
  );
  const currentDefaultBranchForRequestRef = useRef<string | null>(null);
  // Ref so callbacks always read the latest repoUrl without being in dep arrays
  const repoUrlRef = useRef<string>(repoUrl);
  useEffect(() => { repoUrlRef.current = repoUrl; }, [repoUrl]);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(GITHUB_TOKEN_LOCAL_STORAGE_KEY);
      if (storedToken) {
        setGithubToken(storedToken);
      }
    } catch (e) {
      console.warn("Failed to read GitHub token from localStorage:", e);
    }

    if (repoUrl && !isLoading && !digest && !error) {
      const cacheKey = `${CACHED_OUTPUT_PREFIX}${repoUrl}`;
      const cachedDataJSON = localStorage.getItem(cacheKey);
      if (cachedDataJSON) {
        try {
          const cachedData: CachedRepoOutput = JSON.parse(cachedDataJSON);

          setDigest(cachedData.digest);
          setProcessedRepoName(cachedData.processedRepoName);
          setRepoNameForFilename(cachedData.repoNameForFilename);
          setCurrentDefaultBranch(cachedData.defaultBranch);
          setFilesToRenderInDiagram(cachedData.filesToRenderInDiagram || []);
          // Restore skill fields if present
          if (cachedData.skill_md) setSkillMd(cachedData.skill_md);
          if (cachedData.manifest_json) setManifestJson(cachedData.manifest_json);
        } catch (e) {
          console.warn(`Failed to parse or use cached data for ${repoUrl}:`, e);
          localStorage.removeItem(cacheKey);
        }
      }
    }
  }, []);

  useEffect(() => {
    storeInLocalStorage(REPO_URL_LOCAL_STORAGE_KEY, repoUrl || null);
  }, [repoUrl]);

  const githubService = useMemo(() => {
    return new GithubService(githubToken || undefined);
  }, [githubToken]);

  const handleSaveToken = (newToken: string) => {
    const trimmedToken = newToken.trim();
    if (trimmedToken) {
      storeInLocalStorage(GITHUB_TOKEN_LOCAL_STORAGE_KEY, trimmedToken);
      setGithubToken(trimmedToken);
    } else {
      storeInLocalStorage(GITHUB_TOKEN_LOCAL_STORAGE_KEY, null);
      setGithubToken(null);
    }
    setShowTokenModal(false);
  };

  const handleClearToken = () => {
    storeInLocalStorage(GITHUB_TOKEN_LOCAL_STORAGE_KEY, null);
    setGithubToken(null);
    setShowTokenModal(false);
  };



  const processSuccessfulDigestData = useCallback(
    async (
      markdownDigest: string,
      owner: string,
      repo: string,
      defaultBranchFromFetch: string | null,
      digestFilesCount: number | null,
      newSkillMd?: string,
      newManifestJson?: SkillManifest | null,
      newPrimaryLanguages?: string[],
    ) => {
      // Show digest immediately — don't keep user waiting for the tree fetch.
      setDigest(markdownDigest);
      setCurrentDefaultBranch(defaultBranchFromFetch);
      setProgressMessage("Digest ready!");
      setProgressPercent(100);
      setIsLoading(false);

      const branchToUse = defaultBranchFromFetch;

      // Fetch the file tree in the background so it never blocks the main thread.
      // We defer with setTimeout so React can paint the digest result first.
      if (branchToUse && githubService) {
        setTimeout(async () => {
          let diagramFiles: GithubFile[] = [];
          let finalAnalyzedCount = digestFilesCount;
          try {
            diagramFiles = await githubService.getRepoFileTree(
              owner,
              repo,
              branchToUse
            );
            setFilesToRenderInDiagram(diagramFiles);
            const blobFiles = diagramFiles.filter((file) => file.type === "blob");
            finalAnalyzedCount = blobFiles.length;
          } catch (diagramErr: any) {
            console.error(
              "Error fetching repository structure for diagram:",
              diagramErr
            );
          }

          // Defer the localStorage write to avoid blocking the main thread.
          // JSON.stringify on a large digest is synchronous and can freeze the UI.
          const repoDataToCache: CachedRepoOutput = {
            digest: markdownDigest,
            processedRepoName: `${owner}/${repo}`,
            repoNameForFilename: repo,
            defaultBranch: branchToUse,
            filesAnalyzedCount: finalAnalyzedCount,
            filesToRenderInDiagram: diagramFiles,
            timestamp: Date.now(),
            skill_md: newSkillMd,
            manifest_json: newManifestJson ?? undefined,
            primary_languages: newPrimaryLanguages,
          };
          const cacheKey = `${CACHED_OUTPUT_PREFIX}${repoUrlRef.current}`;
          setTimeout(() => {
            try {
              storeInLocalStorage(cacheKey, JSON.stringify(repoDataToCache));
            } catch (e) {
              // quota exceeded or serialization error — non-fatal
            }
          }, 0);
        }, 0);
      } else {
        // No branch info — still cache what we have.
        const repoDataToCache: CachedRepoOutput = {
          digest: markdownDigest,
          processedRepoName: `${owner}/${repo}`,
          repoNameForFilename: repo,
          defaultBranch: branchToUse,
          filesAnalyzedCount: digestFilesCount,
          filesToRenderInDiagram: [],
          timestamp: Date.now(),
          skill_md: newSkillMd,
          manifest_json: newManifestJson ?? undefined,
          primary_languages: newPrimaryLanguages,
        };
        const cacheKey = `${CACHED_OUTPUT_PREFIX}${repoUrlRef.current}`;
        setTimeout(() => {
          try {
            storeInLocalStorage(cacheKey, JSON.stringify(repoDataToCache));
          } catch (e) {}
        }, 0);
      }
    },
    // Only stable references — state setters and the github service.
    // repoUrl is read via repoUrlRef.current so it doesn't need to be here.
    [
      githubService,
      setDigest,
      setCurrentDefaultBranch,
      setFilesToRenderInDiagram,
      setProgressMessage,
      setIsLoading,
      setProgressPercent,
    ]
  );

  const handleGenerateDigest = useCallback(async () => {
    if (!repoUrl) {
      setError("Please enter a GitHub repository URL.");
      return;
    }

    storeInLocalStorage("gitScapeDigestContent", null);

    setIsLoading(true);
    setError(null);
    setDigest("");
    setProgressMessage("Initializing...");
    setProgressPercent(0);

    setProcessedRepoName(undefined);
    setRepoNameForFilename(null);
    setCurrentDefaultBranch(null);
    setFilesToRenderInDiagram([]);
    setSkillMd("");
    setManifestJson(null);
    currentRepoInfoRef.current = null;
    currentDefaultBranchForRequestRef.current = null;


    if (!githubService) {
      setError("GitHub service is not available. Please refresh.");
      setIsLoading(false);
      setProgressMessage("");
      return;
    }

    const parsedUrl = githubService.parseGitHubUrl(repoUrl);
    if (!parsedUrl) {
      setError(
        "Invalid GitHub URL format. Example: https://github.com/owner/repo"
      );
      setIsLoading(false);
      setProgressMessage("");
      return;
    }

    const { owner, repo } = parsedUrl;
    currentRepoInfoRef.current = { owner, repo };
    const currentRepoName = `${owner}/${repo}`;
    setProcessedRepoName(currentRepoName);
    setRepoNameForFilename(repo);

    let defaultBranchForThisRequest: string | null = null;
    try {
      setProgressMessage("Fetching repository details...");
      setProgressPercent(2);
      defaultBranchForThisRequest = await githubService.getDefaultBranch(
        owner,
        repo
      );
      currentDefaultBranchForRequestRef.current = defaultBranchForThisRequest;
      setProgressMessage("Repository details fetched. Connecting to server...");
    } catch (branchError: any) {
      console.error("Failed to fetch default branch:", branchError);
      setError(
        `Failed to fetch repository details (branch): ${branchError.message}. Please ensure the repository is public or a valid GitHub token is provided for private repositories.`
      );
      setIsLoading(false);
      setProgressMessage("Error fetching branch.");
      setProgressPercent(0);
      return;
    }

    const initiateRequest = async () => {
      setProgressMessage("Connecting to server for processing...");
      setProgressPercent(10);
      
      const apiHost = "api.gitscape.ai";
      let apiScheme: string;
      if (apiHost === "api.gitscape.ai") {
        apiScheme = "https";
      } else {
        apiScheme = window.location.protocol === "https:" ? "https" : "http";
      }

      const apiUrl = new URL(`${apiScheme}://${apiHost}/converter`);
      apiUrl.searchParams.append("repo_url", encodeURIComponent(repoUrl));
      if (githubToken) {
        apiUrl.searchParams.append("github_token", encodeURIComponent(githubToken));
      }

      try {
        const response = await fetch(apiUrl.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          let errorDetail = `We couldn't fetch the repository (HTTP ${response.status}).`;
          if (response.status === 503) {
            errorDetail =
              "This repository is too large to process (the server ran out of memory). " +
              "Try a smaller repository or add a GitHub token to enable sparse cloning of private repos.";
          } else {
            try {
              const errorData = await response.json();
              if (errorData.detail) {
                errorDetail = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
              } else if (errorData.message) {
                errorDetail = errorData.message;
              }
            } catch (e) {}
          }
          throw new Error(errorDetail);
        }

        const data = await response.json();
        
        setProgressMessage("Digest generated. Finalizing...");
        setProgressPercent(90);

        const markdownDigest = data.digest;
        if (!markdownDigest || typeof markdownDigest !== 'string') {
          throw new Error("Invalid or empty digest returned by the server.");
        }

        // Store skill fields from enhanced /converter response
        if (data.skill_md) setSkillMd(data.skill_md);
        if (data.manifest_json) setManifestJson(data.manifest_json);

        const branchForProcessing = data.default_branch || currentDefaultBranchForRequestRef.current;
        const digestFilesCount = data.files_analyzed_count !== undefined ? Number(data.files_analyzed_count) : null;

        if (!currentRepoInfoRef.current) {
          throw new Error("Repository owner/name info missing for final processing.");
        }
        const { owner: currentOwner, repo: currentRepo } = currentRepoInfoRef.current;

        await processSuccessfulDigestData(
          markdownDigest,
          currentOwner,
          currentRepo,
          branchForProcessing,
          digestFilesCount,
          data.skill_md,
          data.manifest_json,
          data.primary_languages,
        );

      } catch (err: any) {
        console.error("Error fetching digest:", err);
        setError(
          err.message ||
          "We couldn't fetch the repository. Please add a GitHub Personal Access Token (PAT) and try again."
        );
        setProgressMessage("Error occurred during request.");
        setIsLoading(false);
        setProgressPercent(0);
      }
    };

    initiateRequest();
  // Only truly stable or necessary deps. Volatile state (isLoading, error,
  // digest, progressPercent) is intentionally omitted — they caused the
  // callback to be recreated on every render, triggering render loops.
  }, [
    repoUrl,
    githubToken,
    githubService,
    processSuccessfulDigestData,
  ]);


  // Defer the expensive tree transform to a separate browser task.
  // Using useEffect + setTimeout means this NEVER runs during a user-click
  // event — it always runs in its own task after the browser is idle.
  const [diagramData, setDiagramData] = useState<RawDiagramNode | null>(null);
  useEffect(() => {
    if (!processedRepoName || filesToRenderInDiagram.length === 0) {
      setDiagramData(null);
      return;
    }
    const id = setTimeout(() => {
      setDiagramData(
        transformGithubTreeToD3Hierarchy(filesToRenderInDiagram, processedRepoName)
      );
    }, 0);
    return () => clearTimeout(id);
  }, [filesToRenderInDiagram, processedRepoName]);

  useEffect(() => {
    if (githubService && digest && !processedRepoName && repoUrl) {
      const parsed = githubService.parseGitHubUrl(repoUrl);
      if (parsed) {
        setProcessedRepoName(`${parsed.owner}/${parsed.repo}`);
        if (!repoNameForFilename) {
          setRepoNameForFilename(parsed.repo);
        }
      }
    }
  }, [digest, processedRepoName, repoUrl, githubService, repoNameForFilename]);

  const handleOpenDiagramFullscreenModal = useCallback(
    (data: RawDiagramNode, repoNameModal: string, branch: string | null) => {
      setDiagramDataForModal(data);
      setRepoNameForModal(repoNameModal);
      setDefaultBranchForModal(branch);
      setShowDiagramFullscreenModal(true);
      document.body.style.overflow = "hidden";
    },
    []
  );

  const handleCloseDiagramFullscreenModal = useCallback(() => {
    setShowDiagramFullscreenModal(false);
    setDiagramDataForModal(null);
    setRepoNameForModal(undefined);
    setDefaultBranchForModal(null);
    document.body.style.overflow = "";
  }, []);

  const showOutputArea =
    (!isLoading &&
      (digest || (diagramData && filesToRenderInDiagram.length > 0)) &&
      !error) ||
    (!isLoading && processedRepoName && digest);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col">
      <Header
        onToggleTokenModal={() => setShowTokenModal(true)}
        hasToken={!!githubToken}
      />
      <div className="m-1">
        <div className="relative w-full max-w-4xl mx-auto flex sm:flex-row flex-col justify-center items-start sm:items-center pt-8 sm:pt-0">
          <svg
            className="h-auto w-16 sm:w-20 md:w-24 flex-shrink-0 p-2 md:relative sm:absolute lg:absolute left-0 lg:-translate-x-full md:translate-x-10 sm:-translate-y-16 md:-translate-y-0 -translate-x-2 lg:-translate-y-10"
            viewBox="0 0 91 98"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="m35.878 14.162 1.333-5.369 1.933 5.183c4.47 11.982 14.036 21.085 25.828 24.467l5.42 1.555-5.209 2.16c-11.332 4.697-19.806 14.826-22.888 27.237l-1.333 5.369-1.933-5.183C34.56 57.599 24.993 48.496 13.201 45.114l-5.42-1.555 5.21-2.16c11.331-4.697 19.805-14.826 22.887-27.237Z"
              fill="#FE4A60"
              stroke="#000"
              strokeWidth="3.445"
            ></path>
            <path
              d="M79.653 5.729c-2.436 5.323-9.515 15.25-18.341 12.374m9.197 16.336c2.6-5.851 10.008-16.834 18.842-13.956m-9.738-15.07c-.374 3.787 1.076 12.078 9.869 14.943M70.61 34.6c.503-4.21-.69-13.346-9.49-16.214M14.922 65.967c1.338 5.677 6.372 16.756 15.808 15.659M18.21 95.832c-1.392-6.226-6.54-18.404-15.984-17.305m12.85-12.892c-.41 3.771-3.576 11.588-12.968 12.681M18.025 96c.367-4.21 3.453-12.905 12.854-14"
              stroke="#000"
              strokeWidth="2.548"
              strokeLinecap="round"
            ></path>
          </svg>
          <div className="text-center w-full flex flex-col items-center mt-12">
            <h1 className="text-4xl sm:text-5xl sm:pt-12 lg:pt-5 md:text-6xl lg:text-7xl font-bold tracking-tighter w-full inline-block relative">
              Turn Repos into Skills.
            </h1>
            <p className="mt-3 text-lg sm:text-xl md:text-2xl text-slate-400 font-medium tracking-tight max-w-2xl">
              Give Your Agents the Knowledge to Act.
            </p>
          </div>
          <svg
            className="w-16 lg:w-20 h-auto lg:absolute flex-shrink-0 right-0 bottom-0 md:block hidden translate-y-10 md:translate-y-20 lg:translate-y-4 lg:translate-x-full -translate-x-10"
            viewBox="0 0 92 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="m35.213 16.953.595-5.261 2.644 4.587a35.056 35.056 0 0 0 26.432 17.33l5.261.594-4.587 2.644A35.056 35.056 0 0 0 48.23 63.28l-.595 5.26-2.644-4.587a35.056 35.056 0 0 0-26.432-17.328l-5.261-.595 4.587-2.644a35.056 35.056 0 0 0 17.329-26.433Z"
              fill="#5CF1A4"
              stroke="#000"
              strokeWidth="2.868"
              className=""
            ></path>
            <path
              d="M75.062 40.108c1.07 5.255 1.072 16.52-7.472 19.54m7.422-19.682c1.836 2.965 7.643 8.14 16.187 5.121-8.544 3.02-8.207 15.23-6.971 20.957-1.97-3.343-8.044-9.274-16.588-6.254M12.054 28.012c1.34-5.22 6.126-15.4 14.554-14.369M12.035 28.162c-.274-3.487-2.93-10.719-11.358-11.75C9.104 17.443 14.013 6.262 15.414.542c.226 3.888 2.784 11.92 11.212 12.95"
              stroke="#000"
              strokeWidth="2.319"
              strokeLinecap="round"
            ></path>
          </svg>
        </div>

        <div className="m-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto px-4">
          <div className="bg-slate-800/60 backdrop-blur-md p-6 rounded-xl shadow-xl border border-slate-700/80 hover:border-slate-600 transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-2xl">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-violet-500/20 rounded-full mr-3 shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6 text-violet-400"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-violet-400">
                Code Digest
              </h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Your AI-Ready code digest that converts any Git repository into
              clean text, making it easy to use with your preferred AI models.
            </p>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-md p-6 rounded-xl shadow-xl border border-slate-700/80 hover:border-slate-600 transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-2xl">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-green-500/20 rounded-full mr-3 shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6 text-green-400"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-green-400">
                Code Visualization
              </h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Explore interactive, zoomable diagrams of your GitHub repository
              structures.
            </p>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-md p-6 rounded-xl shadow-xl border border-slate-700/80 hover:border-amber-500/50 transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-2xl">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-amber-500/20 rounded-full mr-3 shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6 text-amber-400"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-amber-400">
                Skill Export
              </h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Instantly generate a ready-to-use agent skill from any repo — a
              structured SKILL.md your AI agents can load and act on.
            </p>
          </div>

        </div>
      </div>
      <main className="container mx-auto px-4 flex-grow max-w-4xl">
        <div className="space-y-12">
          <section
            id="digest-generator-input"
            className="bg-slate-800/80 backdrop-blur-sm p-6 rounded-lg shadow-xl border border-slate-700"
          >
            {isLoading && progressPercent > 0 && (
              <div
                className="w-full bg-slate-600 rounded-full h-2.5 mb-3 overflow-hidden"
                aria-live="polite"
              >
                <div
                  className="bg-violet-500 h-2.5 rounded-full transition-all duration-300 ease-linear"
                  style={{ width: `${progressPercent}%` }}
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Generation progress"
                ></div>
              </div>
            )}
            <RepoInput
              repoUrl={repoUrl}
              setRepoUrl={setRepoUrl}
              onGenerate={handleGenerateDigest}
              isLoading={isLoading}
            />
            {isLoading && progressMessage && (
              <p className="mt-3 text-sm text-violet-400 text-center">
                {progressMessage}
              </p>
            )}
            {error && !isLoading && (
              <p className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-700/50 p-3 rounded-md text-center">
                <span className="font-semibold">Error:</span> {error}
              </p>
            )}
          </section>

          {showOutputArea && (
            <section id="output-area">
              <OutputTabs
                digest={digest}
                isLoadingDigest={isLoading && progressPercent < 100 && !digest}
                diagramData={diagramData}
                repoName={processedRepoName!}
                repoNameForFilename={repoNameForFilename}
                defaultBranch={currentDefaultBranch}
                onOpenDiagramFullscreenModal={handleOpenDiagramFullscreenModal}
                skillMd={skillMd}
                manifestJson={manifestJson}
                repoUrl={repoUrl}
                githubToken={githubToken}
              />
            </section>
          )}
        </div>
      </main>

      <footer className="text-center py-8 mt-auto">
        <p className="text-sm text-slate-500">
          made with ❤️ by{" "}
          <a
            href="https://www.linkedin.com/in/jmachete/"
            target="_blank"
            rel="noopener noreferrer"
          >
            João Machete
          </a>
        </p>
      </footer>

      {showTokenModal && (
        <GithubTokenModal
          isOpen={showTokenModal}
          onClose={() => setShowTokenModal(false)}
          onSaveToken={handleSaveToken}
          onClearToken={handleClearToken}
          currentToken={githubToken || ""}
        />
      )}

      {showDiagramFullscreenModal &&
        diagramDataForModal &&
        repoNameForModal && (
          <DiagramFullscreenModal
            isOpen={showDiagramFullscreenModal}
            onClose={handleCloseDiagramFullscreenModal}
            data={diagramDataForModal}
            repoName={repoNameForModal}
            defaultBranch={defaultBranchForModal || ""}
          />
        )}
    </div>
  );
};

export default App;
