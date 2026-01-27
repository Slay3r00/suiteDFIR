module.exports = {
  packagerConfig: {
    name: 'vdf-tools',
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
        name: 'vdf-tools',
        authors: 'VDF Tools',
        description: 'VDF Forensic Tools',
        noMsi: true,
      },
      platforms: ['win32'],
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
    },
  ],
};
