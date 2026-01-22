/**
 * Custom app:// protocol for VDF Tools Electron App
 * 
 * Handles static file serving in production builds.
 */

const { protocol, net } = require('electron');
const path = require('path');
const config = require('./config');
const logger = require('./logger');

/**
 * Register the custom scheme before app is ready
 * Must be called before app.whenReady()
 */
function registerScheme() {
    if (!config.isDev) {
        protocol.registerSchemesAsPrivileged([
            { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
        ]);
    }
}

/**
 * Register the protocol handler after app is ready
 * Must be called inside app.whenReady()
 */
function registerHandler() {
    if (config.isDev) {
        return; // No custom protocol in dev mode
    }

    const outDir = path.join(process.resourcesPath, 'out');
    logger.info('Registering app:// protocol, outDir:', outDir);

    protocol.handle('app', (request) => {
        const url = new URL(request.url);
        let filePath = url.pathname;

        // Remove leading ./ if present (from relative URLs)
        if (filePath.startsWith('./')) {
            filePath = filePath.substring(1);
        }

        // _next paths should always resolve from root
        const nextIndex = filePath.indexOf('_next/');
        if (nextIndex > 0) {
            filePath = '/' + filePath.substring(nextIndex);
        }

        // Handle root path
        if (filePath === '/' || filePath === '') {
            filePath = '/index.html';
        }

        // Add index.html for directory paths (but not for files with extensions)
        if (filePath.endsWith('/')) {
            filePath += 'index.html';
        } else if (!path.extname(filePath) && !filePath.includes('_next')) {
            filePath += '/index.html';
        }

        const absolutePath = path.join(outDir, filePath);
        logger.debug('Protocol request:', request.url, '->', absolutePath);

        return net.fetch(`file://${absolutePath}`);
    });
}

module.exports = {
    registerScheme,
    registerHandler
};
