module.exports = {
  packagerConfig: {
    name: 'VDF Tools',
    executableName: 'vdf-tools',
    asar: true,
  },
  makers: [
    // macOS
    {
      name: '@electron-forge/maker-dmg',
      config: {},
      platforms: ['darwin', 'mas'],
    },
    // Linux - AppImage (third-party, user-requested)
    {
      name: 'electron-forge-maker-appimage',
      config: {
        options: {
          icon: 'build/icon.png',
        },
      },
      platforms: ['linux'],
    },
    // Linux - Flatpak (official Electron Forge support)
    {
      name: '@electron-forge/maker-flatpak',
      config: {},
      platforms: ['linux'],
    },
    // Windows - Squirrel (for future Windows support)
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        authors: 'VDF Tools',
        description: 'VDF Forensic Tools',
      },
      platforms: ['win32'],
    },
  ],
};
