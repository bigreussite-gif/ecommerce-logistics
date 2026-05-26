import os
import glob

files = glob.glob('src/**/*.tsx', recursive=True)
for f in files:
    with open(f, 'r') as file:
        content = file.read()
        if '<table' in content:
            if 'className="table-container"' not in content:
                print(f"MISSING table-container: {f}")
