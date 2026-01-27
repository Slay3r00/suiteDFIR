const fs = require('fs');
const path = require('path');

module.exports = {
  packagerConfig: {
    name: 'VDF Tools',
    executableName: 'vdf-tools',
    asar: true,
    extraResource: [],
  },
  hooks: {
    postPackage: async (forgeConfig, options) => {
      console.info('  [Hook] Starting postPackage resource copying...');
      const outputPath = options.outputPaths[0];
      const platform = options.platform;

      let resourcesPath;
      if (platform === 'darwin') {
        resourcesPath = path.join(outputPath, 'VDF Tools.app', 'Contents', 'Resources');
      } else {
        resourcesPath = path.join(outputPath, 'resources');
      }

      console.info(`  [Hook] Target resources path: ${resourcesPath}`);

      // Define source paths (relative to electron/ directory)
      const backendSource = path.join(__dirname, '../backend/dist/VDF Tools Backend');
      const frontendSource = path.join(__dirname, '../frontend/out');
      const binSource = path.join(__dirname, '../backend/bin');

      // Copy Helper
      const copyDir = (src, dest) => {
        if (!fs.existsSync(src)) {
          console.warn(`  [Hook] WARNING: Source not found: ${src}`);
          return;
        }
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };

      try {
        // 1. Copy Backend
        console.info('  [Hook] Copying Python backend...');
        copyDir(backendSource, path.join(resourcesPath, 'VDF Tools Backend'));

        // 2. Copy Frontend
        console.info('  [Hook] Copying Frontend static export...');
        copyDir(frontendSource, path.join(resourcesPath, 'out'));

        // 3. Copy Binaries (Platform specific)
        console.info(`  [Hook] Copying binaries for ${platform}...`);
        const binDest = path.join(resourcesPath, 'bin');

        // Always try to copy the platform specific bin folder if it exists
        // Mapping: win32 -> windows, darwin -> macos, linux -> linux
        let platformBinName = platform;
        if (platform === 'win32') platformBinName = 'windows';
        if (platform === 'darwin') platformBinName = 'macos';

        const platformBinSource = path.join(binSource, platformBinName);

        if (fs.existsSync(platformBinSource)) {
          copyDir(platformBinSource, binDest);
          console.info(`  [Hook] Copied binaries from ${platformBinName}`);
        } else {
          console.warn(`  [Hook] No specific binaries found for ${platformBinName} in ${platformBinSource}`);
        }

        console.info('  [Hook] Resource copying complete!');
      } catch (err) {
        console.error('  [Hook] Error copying resources:', err);
        throw err;
      }
    }
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
