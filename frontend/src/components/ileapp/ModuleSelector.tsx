import { useState, useRef } from 'react';
import { Button, Input, Dropdown } from '../ui';
import { useModules, useProfiles, useDropdown, useProcessing } from '../../hooks';
import { Module } from '@/app/(main)/ileapp/types';

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

interface ModuleSelectorProps {
  isProcessing?: boolean;
}

export default function ModuleSelector({ isProcessing = false }: ModuleSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [profileNameInput, setProfileNameInput] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const loadProfileDropdown = useDropdown();
  const saveProfileDropdown = useDropdown();

  const { modules, selectedModules, toggleModule, selectAll, selectNone, fetchModules, tool } = useModules();
  const { profiles, loadProfile, saveProfile, deleteProfile } = useProfiles(tool);

  const handleLoadProfile = async (profileId: number) => {
    try {
      const message = await loadProfile(profileId);
      // Refresh modules to get updated selection state
      await fetchModules();
      // Profile loaded successfully
      loadProfileDropdown.close();
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const handleSaveProfile = async () => {
    const trimmedName = profileNameInput.trim();
    if (!trimmedName) {
      console.warn('Please enter a profile name');
      return;
    }

    try {
      const name = await saveProfile(trimmedName, Array.from(selectedModules));
      setProfileNameInput('');
      saveProfileDropdown.close();
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  };

  const handleDeleteProfile = async (profileId: number) => {
    try {
      await deleteProfile(profileId);
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  };

  const filteredModules = modules.filter(module =>
    searchQuery === '' ||
    module.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    module.module_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    module.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const modulesByCategory = filteredModules.reduce((acc, module) => {
    if (!acc[module.category]) acc[module.category] = [];
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, Module[]>);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Modules</label>

      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-3">
          <div className="relative">
            <Button
              ref={loadProfileDropdown.buttonRef as React.RefObject<HTMLButtonElement>}
              onClick={loadProfileDropdown.handleClick}
              disabled={isProcessing}
              variant="secondary"
              size="sm"
              className="text-xs"
            >
              Load Profile
            </Button>

            <Dropdown isOpen={loadProfileDropdown.isOpen} onClose={loadProfileDropdown.close} align="left" buttonRef={loadProfileDropdown.buttonRef as React.RefObject<HTMLButtonElement>}>
              {profiles.length > 0 ? (
                profiles.map((profile) => (
                  <div key={profile.id} className="flex items-center hover:bg-[#3f3f3f] transition-colors border-b border-gray-700 last:border-b-0">
                    <div
                      onClick={() => handleLoadProfile(profile.id)}
                      className="flex-1 px-4 py-3 text-left text-sm font-medium text-white cursor-pointer whitespace-nowrap"
                    >
                      {profile.name}
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProfile(profile.id);
                      }}
                      className="px-3 py-3 text-white hover:text-red-400 transition-colors cursor-pointer"
                      title="Delete profile"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </div>
                  </div>
                ))
              ) : (
                <div className="whitespace-nowrap px-4 py-3 text-sm text-gray-300 text-center">
                  No saved profiles
                </div>
              )}
            </Dropdown>
          </div>

          <div className="relative">
            <Button
              ref={saveProfileDropdown.buttonRef as React.RefObject<HTMLButtonElement>}
              onClick={saveProfileDropdown.handleClick}
              disabled={isProcessing}
              variant="secondary"
              size="sm"
              className="text-xs"
            >
              Save Profile
            </Button>

            <Dropdown isOpen={saveProfileDropdown.isOpen} onClose={saveProfileDropdown.close} align="left" buttonRef={saveProfileDropdown.buttonRef as React.RefObject<HTMLButtonElement>}>
              <div className="p-4">
                <input
                  value={profileNameInput}
                  onChange={(e) => setProfileNameInput(e.target.value)}
                  disabled={isProcessing}
                  placeholder="Profile name..."
                  className="w-full px-3 py-2 mb-3 bg-[#333333] rounded-lg placeholder-gray-400 text-white text-sm focus:outline-none focus:ring-1 focus:ring-white"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={isProcessing || !profileNameInput.trim()}
                    className="flex-1 px-4 py-2 bg-[#333333] text-white rounded-lg font-medium text-sm hover:bg-[#404040] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      saveProfileDropdown.close();
                      setProfileNameInput('');
                    }}
                    disabled={isProcessing}
                    className="flex-1 px-4 py-2 bg-[#333333] text-white rounded-lg font-medium text-sm hover:bg-[#404040] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </Dropdown>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-white">
            {selectedModules.size}/{modules.length}
          </span>

          <div className="flex gap-3">
            <button
              onClick={selectAll}
              disabled={isProcessing}
              className="text-xs font-bold text-white hover:text-white transition-colors px-2 py-1 rounded hover:bg-[#262626]"
            >
              All
            </button>
            <button
              onClick={selectNone}
              disabled={isProcessing}
              className="text-xs font-bold text-white hover:text-white transition-colors px-2 py-1 rounded hover:bg-[#262626]"
            >
              None
            </button>
          </div>

          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isProcessing}
            placeholder="Search..."
            className="w-32"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-lg p-3 border border-gray-800"
        style={{ backgroundColor: '#171717', borderColor: '#f2f2f2', borderWidth: '0.5px' }}>
        {Object.entries(modulesByCategory).map(([category, categoryModules]) => (
          <div key={category} className="mb-2">
            <div className="text-xs font-medium text-gray-400 mb-1">
              {category}
            </div>
            <div className="space-y-0.5">
              {categoryModules.map((module) => (
                <label
                  key={module.name}
                  className="flex items-center space-x-2 px-2 py-0.5 rounded hover:bg-[#262626] cursor-pointer transition-colors"
                >
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={selectedModules.has(module.name)}
                      onChange={() => toggleModule(module.name, !selectedModules.has(module.name))}
                      disabled={isProcessing}
                      className="w-3.5 h-3.5 rounded border border-white focus:ring-1 focus:ring-gray-600 appearance-none"
                      style={{ borderWidth: '0.5px', backgroundColor: selectedModules.has(module.name) ? '#262626' : 'transparent' }}
                    />
                    {selectedModules.has(module.name) && (
                      <svg className="absolute w-2.5 h-2.5 text-white pointer-events-none" style={{ top: '5.5px', left: '2px' }} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs flex-1 text-white">{module.display_name}</span>
                  {slowModules.has(module.module_name) && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0 rounded border border-white"
                      style={{ borderWidth: '0.5px', backgroundColor: '#262626', color: 'white' }}
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
  );
}