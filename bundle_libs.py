import os
import shutil
import subprocess
import glob

# Source paths
HOMEBREW_PREFIX = "/opt/homebrew"
BINARIES = [
    f"{HOMEBREW_PREFIX}/bin/idevicebackup2",
    f"{HOMEBREW_PREFIX}/bin/idevice_id",
    f"{HOMEBREW_PREFIX}/bin/ideviceinfo"
]

# Destination
DEST_DIR = os.path.abspath("backend/bin")
os.makedirs(DEST_DIR, exist_ok=True)

def run_cmd(cmd):
    print(f"Running: {' '.join(cmd)}")
    subprocess.check_call(cmd)

def get_dependencies(binary_path):
    output = subprocess.check_output(["otool", "-L", binary_path]).decode()
    deps = []
    for line in output.splitlines():
        line = line.strip()
        if line.startswith("/opt/homebrew"):
            path = line.split(" ")[0]
            deps.append(path)
    return deps

def main():
    print("Starting bundling process...")
    
    # Track all copied files to fix them later
    all_files = []

    # 1. Copy Binaries
    for src in BINARIES:
        if not os.path.exists(src):
            print(f"Warning: {src} not found")
            continue
            
        dst = os.path.join(DEST_DIR, os.path.basename(src))
        print(f"Copying {src} -> {dst}")
        shutil.copy2(src, dst)
        os.chmod(dst, 0o755)
        all_files.append(dst)

    # 2. Find and Copy Dependencies (Recursive-ish)
    # We'll just check dependencies of binaries first.
    # ideally we should check dependencies of dependencies, but usually flat is fine for brewed stuff
    libs_to_copy = set()
    
    for bin_file in all_files:
        deps = get_dependencies(bin_file)
        libs_to_copy.update(deps)
        
    print(f"Found {len(libs_to_copy)} dylibs to bundle: {libs_to_copy}")

    for lib_src in libs_to_copy:
        lib_name = os.path.basename(lib_src)
        dst = os.path.join(DEST_DIR, lib_name)
        if not os.path.exists(dst):
             print(f"Copying {lib_src} -> {dst}")
             shutil.copy2(lib_src, dst)
             os.chmod(dst, 0o755) # Ensure writable for install_name_tool
        
        if dst not in all_files:
            all_files.append(dst)

    # 3. Fix references using install_name_tool
    print("Fixing dylib references...")
    
    for target in all_files:
        # Get its current dependencies
        deps = get_dependencies(target)
        
        # Change ID if it's a dylib
        if target.endswith(".dylib"):
             lib_name = os.path.basename(target)
             run_cmd(["install_name_tool", "-id", f"@executable_path/{lib_name}", target])

        # Change dependencies
        for dep in deps:
            dep_name = os.path.basename(dep)
            # We want it to look in the same folder as executable
            new_path = f"@executable_path/{dep_name}"
            run_cmd(["install_name_tool", "-change", dep, new_path, target])

    print("Bundling complete. Verify with otool -L backend/bin/idevicebackup2")

if __name__ == "__main__":
    main()
