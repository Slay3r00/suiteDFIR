'use client';

import { useState, useEffect, useRef } from 'react';

interface Module {
  name: string;
  category: string;
  display_name: string;
  module_name: string;
  enabled: boolean;
  selected: boolean;
}

export default function ILEAPP() {
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [inputFile, setInputFile] = useState<string>('');
  const [outputFolder, setOutputFolder] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'error' | 'stopped'>('idle');
  const [taskId, setTaskId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFileDropdown, setShowFileDropdown] = useState<boolean>(false);
  const [showAdvancedDropdown, setShowAdvancedDropdown] = useState<boolean>(false);
  const [showLoadProfileDropdown, setShowLoadProfileDropdown] = useState<boolean>(false);
  const fileDropdownRef = useRef<HTMLDivElement>(null);
  const advancedDropdownRef = useRef<HTMLDivElement>(null);
  const loadProfileDropdownRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fileDropdownRef.current && !fileDropdownRef.current.contains(event.target as Node)) {
        setShowFileDropdown(false);
      }
      if (advancedDropdownRef.current && !advancedDropdownRef.current.contains(event.target as Node)) {
        setShowAdvancedDropdown(false);
      }
      if (loadProfileDropdownRef.current && !loadProfileDropdownRef.current.contains(event.target as Node)) {
        setShowLoadProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // List of slow modules (from backend modules_to_exclude.py)
  const slowModules = new Set([
    'photosMetadata',
    'walStrings',
    'Ph9BurstAvalanche',
    'Ph10AssetParsedEmbeddedFiles',
    'Ph15PeopleandDetFacesNAD',
    'Ph16AssetPeopleandDetFaces',
    'Ph21AlbumsNonSharedNAD',
    'Ph22AssetsInNonSharedAlbums',
    'Ph23AlbumsSharedNAD',
    'Ph24AssetsInSharedAlbums',
    'Ph26SyndicationPLAssets',
    'Ph31iCloudSharePhotoLibraryNAD',
    'Ph32AssetsIniCldSPLwContrib',
    'Ph33AssetsIniCldSPLfromOtherContrib',
    'Ph34iCloudSharedLinksNAD',
    'Ph35iCloudSharedLinkAssets',
    'Ph50AssetIntResouData',
    'Ph51PossOptimizedAssetsIntResouData',
    'Ph70UserAdjustDateTimezoneLocation',
    'Ph94Ios14REFforAssetAnalysis',
    'Ph95iOS15REFforAssetAnalysis',
    'Ph96iOS16REFforAssetAnalysis',
    'Ph97iOS17REFforAssetAnalysis',
    'Ph98iOS18REFforAssetAnalysis'
  ]);

  // Smart autoscroll state
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const previousScrollTop = useRef(0);

  // Load modules on mount
  useEffect(() => {
    fetchModules();
  }, []);

  // Smart autoscroll: Check if user is near bottom and scroll direction
  useEffect(() => {
    if (logs.length > 0 && logsRef.current && shouldAutoScroll) {
      const lastLog = logsRef.current.lastElementChild;
      if (lastLog) {
        lastLog.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  }, [logs, shouldAutoScroll]);

  // Handle user scroll events to detect direction and position
  const handleScroll = () => {
    const container = logsRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const currentScrollTop = scrollTop;
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 50; // 50px threshold
    const isScrollingUp = currentScrollTop < previousScrollTop.current;
    const isScrollingDown = currentScrollTop > previousScrollTop.current;

    // Update previous scroll position
    previousScrollTop.current = currentScrollTop;

    // If user scrolled up, disable autoscroll
    if (isScrollingUp) {
      setShouldAutoScroll(false);
      setUserScrolledUp(true);
      return;
    }

    // If user scrolled down AND is near bottom AND had previously scrolled up
    if (isScrollingDown && isAtBottom && userScrolledUp) {
      setShouldAutoScroll(true);
      setUserScrolledUp(false);
      return;
    }

    // If user is at bottom (near bottom threshold), enable autoscroll
    if (isAtBottom && !userScrolledUp) {
      setShouldAutoScroll(true);
    }
  };

  const fetchModules = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/modules');
      if (res.ok) {
        const data = await res.json();
        setModules(data.modules);
        const initiallySelected = new Set<string>(
          data.modules.filter((m: Module) => m.selected).map((m: Module) => m.name)
        );
        setSelectedModules(initiallySelected);
      }
    } catch (error) {
      appendLog('Failed to load modules');
    }
  };

  const appendLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const toggleModule = async (name: string, selected: boolean) => {
    const newSelected = new Set<string>(selectedModules);
    if (selected) newSelected.add(name);
    else newSelected.delete(name);
    setSelectedModules(newSelected);

    try {
      await fetch('http://localhost:8000/api/modules/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [name]: selected }),
      });
    } catch (error) {
      appendLog('Failed to update module');
    }
  };

  const browseFiles = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/browse-files', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.file_path) {
        setInputFile(data.file_path);
        appendLog(`Selected: ${data.file_path.split('/').pop()}`);
      }
    } catch (error) {
      appendLog('File selection failed');
    }
  };

  const browseFolders = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/browse-folders', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.file_path) {
        setOutputFolder(data.file_path);
        appendLog(`Output: ${data.file_path.split('/').pop()}`);
      }
    } catch (error) {
      appendLog('Folder selection failed');
    }
  };

  const browseInputFolders = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/browse-folders', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.file_path) {
        setInputFile(data.file_path);
        appendLog(`Selected folder: ${data.file_path.split('/').pop()}`);
      }
    } catch (error) {
      appendLog('Folder selection failed');
    }
  };

  const stopProcessing = async () => {
    if (!taskId) return;
    try {
      await fetch(`http://localhost:8000/api/process/stop/${taskId}`, { method: 'POST' });
      setStatus('stopped');
      setIsProcessing(false);
      appendLog('Processing stopped');
    } catch (error) {
      appendLog('Stop failed');
    }
  };

  const startProcessing = async () => {
    if (!inputFile || selectedModules.size === 0 || !outputFolder) {
      alert('Select file, output folder, and modules');
      return;
    }

    setIsProcessing(true);
    setStatus('processing');
    setLogs([]);
    // Reset autoscroll state when starting new processing
    setShouldAutoScroll(true);
    setUserScrolledUp(false);
    previousScrollTop.current = 0;
    appendLog('Starting iLEAPP...');

    try {
      const res = await fetch('http://localhost:8000/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_path: inputFile,
          output_folder: outputFolder,
          selected_modules: Array.from(selectedModules),
          timezone_offset: 'UTC'
        }),
      });

      const data = await res.json();
      const newTaskId = data.task_id;
      setTaskId(newTaskId);
      appendLog(`Task: ${newTaskId}`);

      const eventSource = new EventSource(`http://localhost:8000/api/process/stream/${newTaskId}`);

      eventSource.onmessage = (e) => {
        const msg = e.data;
        appendLog(msg);
        if (msg.includes('Processing completed')) {
          setStatus('completed');
          setIsProcessing(false);
          eventSource.close();
        } else if (msg.includes('Processing stopped')) {
          setStatus('stopped');
          setIsProcessing(false);
          eventSource.close();
        }
      };

      eventSource.onerror = () => appendLog('Stream error');
    } catch (error) {
      setStatus('error');
      setIsProcessing(false);
      appendLog('Processing failed');
    }
  };

  const Button = ({ children, onClick, disabled = false, variant = 'primary' }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'danger';
  }) => {
    const base = 'px-4 py-2 rounded-lg font-bold transition-all text-sm border';
    const variants = {
      primary: disabled
        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
        : 'bg-black text-white hover:bg-gray-900 active:scale-95',
      secondary: disabled
        ? 'text-black hover:bg-gray-100 active:scale-95'
        : 'text-black hover:bg-gray-100 active:scale-95',
      danger: disabled
        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
        : 'bg-black text-red-600 border border-red-600 hover:border-red-700 active:scale-95',
    };
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`${base} ${variants[variant]}`}
        style={variant === 'secondary' ? {backgroundColor: '#f2f2f2', borderColor: '#171717'} : {borderColor: '#171717'}}
      >
        {children}
      </button>
    );
  };

  return (
    <div className="h-screen w-screen" style={{backgroundColor: '#30444f', color: 'white', display: 'flex', padding: '2rem', gap: '2rem'}}>
      {/* Left Panel - Input & Controls */}
      <div className="w-1/2 h-full flex flex-col gap-6">
        {/* File Input */}
        <div className="space-y-2">
          <div className="flex gap-3">
            <input
              type="text"
              value={inputFile}
              onChange={(e) => setInputFile(e.target.value)}
              disabled={isProcessing}
              placeholder="Select input file..."
              className="flex-1 px-3 py-2 rounded-lg placeholder-gray-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white text-white border border-gray-800 text-sm"
              style={{backgroundColor: '#171717', borderColor: '#f2f2f2'}}
            />
            <div className="relative" ref={fileDropdownRef}>
              <button
                onClick={() => setShowFileDropdown(!showFileDropdown)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg font-bold transition-all text-sm text-black hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed border"
                style={{backgroundColor: '#f2f2f2', borderColor: '#171717'}}
              >
                Browse
              </button>

              {showFileDropdown && (
                <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg z-50 whitespace-nowrap border" style={{borderColor: '#171717'}}>
                  <button
                    onClick={() => {
                      browseFiles();
                      setShowFileDropdown(false);
                    }}
                    className="block w-full px-4 py-2 text-right text-xs font-bold text-black hover:bg-gray-200 transition-colors rounded-t-lg border-b"
                    style={{borderColor: '#171717'}}
                  >
                    Choose File
                  </button>
                  <button
                    onClick={() => {
                      browseInputFolders();
                      setShowFileDropdown(false);
                    }}
                    className="block w-full px-4 py-2 text-right text-xs font-bold text-black hover:bg-gray-200 transition-colors rounded-b-lg"
                  >
                    Choose Folder
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Output Folder */}
        <div className="space-y-2">
          <div className="flex gap-3">
            <input
              type="text"
              value={outputFolder}
              onChange={(e) => setOutputFolder(e.target.value)}
              disabled={isProcessing}
              placeholder="Select output folder..."
              className="flex-1 px-3 py-2 rounded-lg placeholder-gray-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white text-white border border-gray-800 text-sm"
              style={{backgroundColor: '#171717', borderColor: '#f2f2f2'}}
            />
            <Button onClick={browseFolders} disabled={isProcessing} variant="secondary">
              Browse
            </Button>
          </div>
        </div>

        {/* Profile and Options Row */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <div className="relative" ref={loadProfileDropdownRef}>
              <button
                onClick={() => setShowLoadProfileDropdown(!showLoadProfileDropdown)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg font-bold transition-all text-sm text-black hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed border"
                style={{backgroundColor: '#f2f2f2', borderColor: '#171717'}}
              >
                Load Profile
              </button>

              {showLoadProfileDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg z-50 whitespace-nowrap border" style={{borderColor: '#171717'}}>
                  <button
                    onClick={() => setShowLoadProfileDropdown(false)}
                    className="block w-full px-4 py-2 text-left text-xs font-bold text-black hover:bg-gray-200 transition-colors rounded-lg"
                  >
                    Coming Soon...
                  </button>
                </div>
              )}
            </div>
            <Button onClick={() => {}} disabled={isProcessing} variant="secondary">
              Save Profile
            </Button>
          </div>
          <div className="relative" ref={advancedDropdownRef}>
              <button
                onClick={() => setShowAdvancedDropdown(!showAdvancedDropdown)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg font-bold transition-all text-sm text-black hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed border"
                style={{backgroundColor: '#f2f2f2', borderColor: '#171717'}}
              >
                Advanced Options
              </button>

              {showAdvancedDropdown && (
                <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg z-50 whitespace-nowrap border" style={{borderColor: '#171717'}}>
                  <button
                    onClick={() => setShowAdvancedDropdown(false)}
                    className="block w-full px-4 py-2 text-right text-xs font-bold text-black hover:bg-gray-200 transition-colors rounded-lg"
                  >
                    Coming Soon...
                  </button>
                </div>
              )}
            </div>
        </div>

        {/* Module Selection */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-white">Modules</span>
            <div className="flex items-center gap-4">
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    const allModuleNames: string[] = modules.map(m => m.name);
                    const newSelected = new Set<string>(allModuleNames);
                    setSelectedModules(newSelected);

                    // Update all modules to selected state
                    const selectionUpdates: Record<string, boolean> = {};
                    modules.forEach(m => {
                      selectionUpdates[m.name] = true;
                    });

                    try {
                      await fetch('http://localhost:8000/api/modules/select', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(selectionUpdates),
                      });
                    } catch (error) {
                      appendLog('Failed to update modules');
                    }
                  }}
                  disabled={isProcessing}
                  className="text-xs font-bold text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-800"
                >
                  All
                </button>
                <button
                  onClick={async () => {
                    setSelectedModules(new Set<string>());

                    // Update all modules to unselected state
                    const selectionUpdates: Record<string, boolean> = {};
                    modules.forEach(m => {
                      selectionUpdates[m.name] = false;
                    });

                    try {
                      await fetch('http://localhost:8000/api/modules/select', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(selectionUpdates),
                      });
                    } catch (error) {
                      appendLog('Failed to update modules');
                    }
                  }}
                  disabled={isProcessing}
                  className="text-xs font-bold text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-800"
                >
                  None
                </button>
              </div>
              <span className="text-xs font-bold text-gray-400">
                {selectedModules.size}/{modules.length}
              </span>
              <div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isProcessing}
                  placeholder="Search modules..."
                  className="w-48 px-3 py-2 rounded-lg placeholder-gray-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white text-white border border-gray-800 text-sm"
                  style={{backgroundColor: '#171717', borderColor: '#f2f2f2'}}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto rounded-lg p-3 border border-gray-800" style={{backgroundColor: '#171717', borderColor: '#f2f2f2'}}>
            {Object.entries(
              modules
                .filter(module =>
                  searchQuery === '' ||
                  module.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  module.module_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  module.category.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .reduce((acc, module) => {
                  if (!acc[module.category]) acc[module.category] = [];
                  acc[module.category].push(module);
                  return acc;
                }, {} as Record<string, Module[]>)
            ).map(([category, categoryModules]) => (
              <div key={category} className="mb-4">
                <div className="text-xs font-medium text-gray-400 mb-2">
                  {category}
                </div>
                <div className="space-y-1">
                  {categoryModules.map((module) => (
                    <label
                      key={module.name}
                      className="flex items-center space-x-3 p-2 rounded hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={selectedModules.has(module.name)}
                          onChange={() => toggleModule(module.name, !selectedModules.has(module.name))}
                          disabled={isProcessing}
                          className="w-4 h-4 rounded border border-white focus:ring-2 focus:ring-gray-600 appearance-none"
                          style={{backgroundColor: selectedModules.has(module.name) ? '#30444f' : 'transparent'}}
                        />
                        {selectedModules.has(module.name) && (
                          <svg className="absolute w-3 h-3 text-white pointer-events-none" style={{top: '3.5px', left: '2px'}} viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm flex-1 text-white">{module.display_name}</span>
                      {slowModules.has(module.module_name) && (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded border border-white"
                          style={{backgroundColor: '#30444f', color: 'white'}}
                        >
                          Slow
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Process Controls */}
        <div className="space-y-3">
          <button
            onClick={isProcessing ? stopProcessing : startProcessing}
            disabled={!inputFile || selectedModules.size === 0 || !outputFolder}
            className="w-full px-4 py-2 rounded-lg font-bold transition-all text-sm text-black hover:bg-gray-100 active:scale-95 border"
            style={{backgroundColor: '#f2f2f2', borderColor: '#171717'}}
          >
            {isProcessing ? 'Stop Processing' : 'Start Processing'}
          </button>
        </div>
      </div>

      {/* Right Panel - Logs */}
      <div className="w-1/2 h-full">
        <div
          ref={logsRef}
          onScroll={handleScroll}
          className="h-full rounded-lg overflow-y-auto font-mono text-xs leading-relaxed border border-gray-800 p-4"
          style={{backgroundColor: '#171717', color: 'white', borderColor: '#f2f2f2'}}
        >
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))
          ) : (
            <div className="flex items-center justify-center h-full text-white">
              <p>No logs yet. Start processing to see real-time output.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}