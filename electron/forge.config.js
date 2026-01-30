module.exports = {
  packagerConfig: {
    name: 'vdf-tools',
    executableName: 'vdf-tools',
    asar: true,
  },
  makers: [
    // macOS DMG
    {
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'VDF Tools',
        format: 'ULFO',
      },
    },
    // macOS ZIP (as fallback)
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
  ],
};
