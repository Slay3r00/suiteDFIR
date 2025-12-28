module.exports = {
  packagerConfig: {
    name: 'VDF Tools',
    executableName: 'vdf-tools',
    asar: true,
  },
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      config: {},
    },
  ],
};
