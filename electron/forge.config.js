module.exports = {
  packagerConfig: {
    name: 'vdf-tools',
    executableName: 'vdf-tools',
    asar: true,
  },
    // macOS DMG
    {
  name: '@electron-forge/maker-dmg',
    config: {
    name: 'VDF Tools',
      format: 'ULFO',
      },
},
// Windows Squirrel
{
  name: '@electron-forge/maker-squirrel',
    config: {
    name: 'vdf_tools',
      },
},
// ZIP (macOS + Windows as portable)
{
  name: '@electron-forge/maker-zip',
    platforms: ['darwin', 'win32'],
    },
  ],
};
