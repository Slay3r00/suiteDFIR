#!/bin/bash

# Script to relink MacOS binaries and dylibs in backend/bin for portability.
# Replaces absolute Homebrew paths with @executable_path/ relative paths.

set -e

BIN_DIR="${1:-backend/bin}"

if [ ! -d "$BIN_DIR" ]; then
    echo "Error: $BIN_DIR not found."
    exit 1
fi

echo "Relinking binaries in $BIN_DIR..."

# List of binaries to fix
BINARIES=("idevice_id" "idevicebackup2" "ideviceinfo")

# List of dylibs and their destination names (basenames)
# We use a loop over the glob to handle spaces correctly
for dylib_path in "$BIN_DIR"/*.dylib; do
    [ -e "$dylib_path" ] || continue
    dylib=$(basename "$dylib_path")
    
    for bin in "${BINARIES[@]}"; do
        TARGET="$BIN_DIR/$bin"
        if [ -f "$TARGET" ]; then
            echo "Processing $bin..."
            
            # Get all dependencies from otool
            # Filter for /opt/homebrew paths
            otool -L "$TARGET" | grep "/opt/homebrew" | awk '{print $1}' | while read -r dep; do
                [ -z "$dep" ] && continue
                
                # Extract the filename from the dependency path
                filename=$(basename "$dep")
                
                # Check if we have this dylib in our bin directory
                if [ -f "$BIN_DIR/$filename" ]; then
                    echo "  Relinking $dep -> @executable_path/$filename"
                    install_name_tool -change "$dep" "@executable_path/$filename" "$TARGET"
                else
                    echo "  Warning: Dependency $dep found but $filename not in $BIN_DIR"
                fi
            done
            
            # Also ensure it has an RPATH to . just in case
            install_name_tool -add_rpath "@executable_path/." "$TARGET" 2>/dev/null || true
        fi
    done
    # Break after one pass through binaries to avoid redundant work
    break
done

# Second pass: Fix the IDs of the dylibs themselves so they are reachable
for dylib_path in "$BIN_DIR"/*.dylib; do
    [ -e "$dylib_path" ] || continue
    dylib=$(basename "$dylib_path")
    TARGET="$dylib_path"
    
    echo "Fixing ID for $dylib..."
    
    # Set the identity of the dylib to @executable_path/basename
    install_name_tool -id "@executable_path/$dylib" "$TARGET"
    
    # Also fix dependencies of the dylibs themselves
    otool -L "$TARGET" | grep "/opt/homebrew" | awk '{print $1}' | while read -r dep; do
        [ -z "$dep" ] && continue
        filename=$(basename "$dep")
        if [ -f "$BIN_DIR/$filename" ]; then
            echo "  Relinking dylib dep $dep -> @executable_path/$filename"
            install_name_tool -change "$dep" "@executable_path/$filename" "$TARGET"
        fi
    done
done

echo "Relinking complete."
