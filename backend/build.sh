#!/bin/bash
# Build script for VDF Tools Python backend

set -e

echo "Building VDF Tools backend for production..."

# Activate venv
source venv/bin/activate

# Install PyInstaller if not already installed
pip install pyinstaller

# Clean previous builds
rm -rf build dist

# Build with PyInstaller
pyinstaller build.spec.py

echo "✅ Backend build complete!"
echo "Executable location: backend/dist/VDF Tools Backend/vdf-backend"
