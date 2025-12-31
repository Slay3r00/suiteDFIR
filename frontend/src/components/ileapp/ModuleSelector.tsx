import { useState } from 'react';
import { Button, Input, Dropdown, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui';
import { useModules, useProfiles, useDropdown } from '../../hooks';
import { Module } from '@/app/(main)/ileapp/types';
import { Trash2 } from 'lucide-react';

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

export default function ModuleSelector({ isProcessing }: ModuleSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [profileNameInput, setProfileNameInput] = useState('');
  const [confirmDeleteProfileId, setConfirmDeleteProfileId] = useState<number | null>(null);

  const loadProfileDropdown = useDropdown();
  const saveProfileDropdown = useDropdown();

  const { modules, selectedModules, toggleModule, selectAll, selectNone, fetchModules, tool } = useModules();
  const { profiles, loadProfile, saveProfile, deleteProfile } = useProfiles(tool);

  const handleLoadProfile = async (profileId: number) => {
    try {
      await loadProfile(profileId);
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
      await saveProfile(trimmedName, Array.from(selectedModules));
      setProfileNameInput('');
      saveProfileDropdown.close();
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  };

  const handleDeleteProfile = async (profileId: number) => {
    setConfirmDeleteProfileId(profileId);
  };

  const confirmDelete = async () => {
    if (confirmDeleteProfileId === null) return;
    try {
      await deleteProfile(confirmDeleteProfileId);
      setConfirmDeleteProfileId(null);
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
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1 relative -top-[3px]">Modules</label>

      <div className="flex items-center justify-between mb-3 gap-4">
        <div className="flex gap-3 shrink-0">
          <div className="relative">
            <Button
              ref={loadProfileDropdown.buttonRef as React.RefObject<HTMLButtonElement>}
              // eslint-disable-next-line react-hooks/refs
              onClick={loadProfileDropdown.handleClick}
              disabled={isProcessing}
              variant="secondary"
              size="sm"
              className="text-xs"
            >
              Load Profile
            </Button>

            {/* eslint-disable-next-line react-hooks/refs */}
            <Dropdown
              isOpen={loadProfileDropdown.isOpen}
              onClose={loadProfileDropdown.close}
              align="left"
              buttonRef={loadProfileDropdown.buttonRef as React.RefObject<HTMLButtonElement>}
              className="min-w-[200px] whitespace-nowrap bg-[#1A1A1A] border border-[#333] rounded-lg shadow-xl overflow-hidden"
            >
              <div className="bg-[#212121] px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider border-b border-[#333]">
                Saved Profiles
              </div>
              <div className="max-h-[200px] overflow-y-auto custom-scrollbar bg-[#1A1A1A]">
                {profiles.length > 0 ? (
                  profiles.map((profile) => (
                    <div key={profile.id} className="flex items-center hover:bg-[#2a2a2a] transition-colors border-b border-[#262626] last:border-b-0">
                      <div
                        onClick={() => handleLoadProfile(profile.id)}
                        className="flex-1 px-3 py-2 text-left text-xs font-medium text-gray-300 hover:text-white cursor-pointer truncate"
                      >
                        {profile.name}
                      </div>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProfile(profile.id);
                        }}
                        className="px-3 py-2 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete profile"
                      >
                        <Trash2 size={12} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-xs text-gray-500 text-center">
                    No saved profiles
                  </div>
                )}
              </div>
            </Dropdown>
          </div>

          <div className="relative">
            <Button

              ref={saveProfileDropdown.buttonRef as React.RefObject<HTMLButtonElement>}
              // eslint-disable-next-line react-hooks/refs
              onClick={saveProfileDropdown.handleClick}
              disabled={isProcessing}
              variant="secondary"
              size="sm"
              className="text-xs"
            >
              Save Profile
            </Button>

            {/* eslint-disable-next-line react-hooks/refs */}
            <Dropdown
              isOpen={saveProfileDropdown.isOpen}
              onClose={saveProfileDropdown.close}
              align="left"
              buttonRef={saveProfileDropdown.buttonRef as React.RefObject<HTMLButtonElement>}
              className="min-w-[220px] bg-[#1A1A1A] border border-[#333] rounded-lg shadow-xl overflow-hidden"
            >
              <div className="bg-[#212121] px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider border-b border-[#333]">
                Create Profile
              </div>
              <div className="p-3 bg-[#1A1A1A]">
                <Input
                  value={profileNameInput}
                  onChange={(e) => setProfileNameInput(e.target.value)}
                  disabled={isProcessing}
                  placeholder="Profile name..."
                  className="w-full h-8 mb-2 text-[11px]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={isProcessing || !profileNameInput.trim()}
                    className="flex-1 h-7 bg-[#333333] text-white rounded text-[11px] font-medium hover:bg-[#404040] transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-white/5"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      saveProfileDropdown.close();
                      setProfileNameInput('');
                    }}
                    disabled={isProcessing}
                    className="flex-1 h-7 bg-[#262626] text-gray-400 rounded text-[11px] font-medium hover:bg-[#333333] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-[#333]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </Dropdown>
          </div>
        </div>

        <div className="flex-1 max-w-xs">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isProcessing}
            placeholder="Search modules..."
            className="w-full h-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border flex flex-col"
        style={{ backgroundColor: '#171717', borderColor: '#333333' }}>

        {/* Selection Controls Header - Sticky in visual sense but at top of box */}
        <div className="px-3 py-2 border-b border-[#333333] bg-[#1A1A1A] flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Selection: <span className="text-white ml-1">{selectedModules.size}/{modules.length}</span>
          </span>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              disabled={isProcessing}
              className="text-[10px] font-bold text-gray-400 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-[#262626] uppercase tracking-wider"
            >
              All
            </button>
            <button
              onClick={selectNone}
              disabled={isProcessing}
              className="text-[10px] font-bold text-gray-400 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-[#262626] uppercase tracking-wider"
            >
              None
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 pt-2 custom-scrollbar">
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

      <Dialog open={confirmDeleteProfileId !== null} onOpenChange={(open) => !open && setConfirmDeleteProfileId(null)}>
        <DialogContent className="max-w-[340px] p-5 bg-[#1A1A1A] border-[#333333]">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-white tracking-wide uppercase">Delete Profile</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Are you sure you want to delete this profile? This cannot be undone.
            </p>
          </div>
          <DialogFooter className="mt-2 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 h-8 text-[11px]"
              onClick={() => setConfirmDeleteProfileId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 h-8 text-[11px] bg-red-900/20 hover:bg-red-900/40 text-white border border-red-900/30"
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}