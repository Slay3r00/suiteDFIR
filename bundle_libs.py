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

    # 2. Find and Copy Dependencies (Recursive)
    libs_to_copy = set()
    processed_files = set(all_files) # Files we have already scanned
    queue = list(all_files)          # Files to scan
    
    print("Scanning for recursive dependencies...")
    while queue:
        current_file = queue.pop(0)
        deps = get_dependencies(current_file)
        
        for dep in deps:
            if dep not in libs_to_copy:
                libs_to_copy.add(dep)
                # We need to copy this new lib, so we must also scan IT for dependencies
                # But we can only scan it after we copy it to our destination, 
                # or we just assume its source path is scanable. Dylibs in brew are scanable.
                
                # Check if we've already processed this specific source file path
                if dep not in processed_files:
                     queue.append(dep)
                     processed_files.add(dep)

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
    print("Fixing dylib references & Re-signing...")
    
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
            
        # Ad-hoc sign to prevent Gatekeeper issues on other machines
        subprocess.run(["codesign", "-s", "-", "--force", target], check=False)

    print("Bundling complete. Verify with otool -L backend/bin/idevicebackup2")

if __name__ == "__main__":
    main()
