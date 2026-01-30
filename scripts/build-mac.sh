#!/bin/bash

# VDF Tools Production Build Script for macOS
# This script builds the complete production bundle including:
# - Python backend executable
# - Vite static frontend build
# - Electron app bundle
# - DMG distributable

# Set project root relative to script location
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_ROOT"

echo "Building VDF Tools for macOS..."

# Step 1: Build Python backend
echo ""
echo "Building Python backend..."
cd backend
source venv/bin/activate
rm -rf build dist
pyinstaller build.spec
cd "$PROJECT_ROOT"
echo "Backend built"

# Step 2: Build Frontend
echo ""
echo "Building frontend..."
cd frontend
npm run build
cd "$PROJECT_ROOT"
echo "Frontend built"

# Step 3: Package Electron App
echo ""
echo "Packaging Electron app..."
cd electron
rm -rf out
npm install
npx electron-forge package

# Copy resources manually (extraResource doesn't work reliably)
APP_PATH="out/vdf-tools-darwin-arm64/vdf-tools.app"
RESOURCES_PATH="$APP_PATH/Contents/Resources"

echo "  Copying Python backend..."
cp -R ../backend/dist/VDF\ Tools\ Backend "$RESOURCES_PATH/"

echo "  Copying helper binaries (macOS only)..."
mkdir -p "$RESOURCES_PATH/bin"
cp -R ../backend/bin/macos/* "$RESOURCES_PATH/bin/"

echo "  Signing binaries for portability..."
codesign --force --deep --sign - "$RESOURCES_PATH/bin/"*


echo "  Copying frontend..."
cp -R ../frontend/dist "$RESOURCES_PATH/"

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
echo "  - Electron .app: electron/out/vdf-tools-darwin-arm64/vdf-tools.app"
echo "  - DMG Installer: electron/out/make/vdf-tools-0.1.0-arm64.dmg"

