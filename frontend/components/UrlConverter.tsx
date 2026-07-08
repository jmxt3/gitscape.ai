
import React, { useState, useEffect } from 'react';
import { URL_CONVERSION_TARGET_DOMAIN } from '../constants';

interface UrlConverterProps {
  initialUrl?: string;
}

export const UrlConverter: React.FC<UrlConverterProps> = ({ initialUrl = '' }) => {
  const [inputUrl, setInputUrl] = useState<string>(initialUrl);
  const [convertedUrl, setConvertedUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setInputUrl(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    if (inputUrl) {
      try {
        const url = new URL(inputUrl);
        if (url.hostname === 'github.com') {
          const newHostname = URL_CONVERSION_TARGET_DOMAIN;
          url.hostname = newHostname;
          setConvertedUrl(url.toString());
        } else if (inputUrl.includes('github.com')) {
            setConvertedUrl(inputUrl.replace(/github\.com/g, URL_CONVERSION_TARGET_DOMAIN));
        } else if (inputUrl.includes('hub')) {
            const replaced = inputUrl.replace(/([a-zA-Z0-9.-]*?)hub([a-zA-Z0-9.-]*?\.[a-zA-Z]{2,})/, `$1diagram$2`);
            if (replaced !== inputUrl) {
                 setConvertedUrl(replaced);
            } else {
                 setConvertedUrl('Not a standard GitHub.com URL for direct conversion. Try editing manually.');
            }
        }
        else {
          setConvertedUrl('Enter a GitHub.com URL to convert.');
        }
      } catch (error) {
        setConvertedUrl('Invalid URL format.');
      }
    } else {
      setConvertedUrl('');
    }
  }, [inputUrl]);

  const handleCopy = () => {
    if (convertedUrl && !convertedUrl.startsWith('Invalid') && !convertedUrl.startsWith('Enter a')) {
      navigator.clipboard.writeText(convertedUrl)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(err => console.error('Failed to copy URL: ', err));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="githubUrlInput" className="block text-sm font-medium text-slate-300 mb-1">
          GitHub URL
        </label>
        <input
          type="url"
          id="githubUrlInput"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder="e.g., https://github.com/owner/repo"
          className="w-full px-4 py-2 border border-slate-600 rounded-md shadow-sm focus:ring-violet-500 focus:border-violet-500 bg-slate-700 text-slate-100 placeholder-slate-400"
        />
      </div>
      {convertedUrl && (
        <div>
          <label htmlFor="convertedUrlOutput" className="block text-sm font-medium text-slate-300 mb-1">
            Converted URL (for services like {URL_CONVERSION_TARGET_DOMAIN})
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              id="convertedUrlOutput"
              readOnly
              value={convertedUrl}
              className="w-full px-4 py-2 border border-slate-700 rounded-md bg-slate-700 text-slate-200 placeholder-slate-400"
            />
            <button
              onClick={handleCopy}
              disabled={!convertedUrl || convertedUrl.startsWith('Invalid') || convertedUrl.startsWith('Enter a')}
              className="px-4 py-2 text-sm font-medium text-violet-300 bg-slate-700 hover:bg-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
           <p className="mt-2 text-xs text-slate-400">
            This conversion typically replaces 'github.com' with '{URL_CONVERSION_TARGET_DOMAIN}'. Some tools might use a different domain.
          </p>
        </div>
      )}
    </div>
  );
};