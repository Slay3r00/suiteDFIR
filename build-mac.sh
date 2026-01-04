#!/bin/bash

# VDF Tools Production Build Script for macOS
# This script builds the complete production bundle including:
# - Python backend executable
# - Next.js static frontend export
# - Electron app bundle
# - DMG distributable

set -e  # Exit on error

echo "Building VDF Tools for macOS..."

# Step 1: Build Python backend
echo ""
echo "Building Python backend..."
cd backend
source venv/bin/activate
rm -rf build dist
pyinstaller build.spec
cd ..
echo "Backend built"

# Step 2: Build Frontend
echo ""
echo "Building frontend static export..."
cd frontend
npm run build:static
cd ..
echo "Frontend built"

# Step 3: Package Electron App
echo ""
echo "Packaging Electron app..."
cd electron
rm -rf out
npm install
npx electron-forge package

# Copy resources manually (extraResource doesn't work reliably)
APP_PATH="out/VDF Tools-darwin-arm64/VDF Tools.app"
RESOURCES_PATH="$APP_PATH/Contents/Resources"

echo "  Copying Python backend..."
cp -R ../backend/dist/VDF\ Tools\ Backend "$RESOURCES_PATH/"

echo "  Copying frontend..."
cp -R ../frontend/out "$RESOURCES_PATH/"

echo "  Creating reports directory..."
mkdir -p "$RESOURCES_PATH/reports"

echo "Electron app packaged"

# Step 4: Create DMG
echo ""
echo "Creating DMG distributable..."
npx electron-forge make --skip-package
echo "DMG created"

# Done
echo ""
echo "Build complete"
echo ""
echo "Output files:"
echo "  - Electron .app: electron/out/VDF Tools-darwin-arm64/VDF Tools.app"
echo "  - DMG Installer: electron/out/make/VDF Tools-0.1.0-arm64.dmg"
