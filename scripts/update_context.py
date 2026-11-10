#!/usr/bin/env python3
import os
import subprocess

root_dir = "/home/milk13/IdeaProjects/jrnl"
context_file = os.path.join(root_dir, "project_context.md")

tree_out = subprocess.check_output(
    ["tree", "-I", "target|.git|.idea|.mvn|instance"],
    cwd=root_dir,
    text=True
)

file_extensions = (".java", ".js", ".css", ".html", ".sql", ".properties", ".xml")
special_files = ("README.md", "pom.xml")

collected_files = []
for dirpath, dirnames, filenames in os.walk(root_dir):
    if any(p in dirpath for p in ["/target", "/.git", "/.idea", "/.mvn", "/instance"]):
        continue
    for f in sorted(filenames):
        if f.endswith(file_extensions) or f in special_files:
            rel_path = os.path.relpath(os.path.join(dirpath, f), root_dir)
            collected_files.append(rel_path)

collected_files.sort()

with open(context_file, "w", encoding="utf-8") as out:
    out.write("# Структура проекта\n")
    out.write(tree_out.strip() + "\n\n")
    out.write("## Содержимое ключевых файлов проекта\n\n")
    for rel in collected_files:
        full_path = os.path.join(root_dir, rel)
        out.write(f"### `{rel}`\n\n")
        ext = os.path.splitext(rel)[1].lstrip(".")
        lang = ext if ext else "text"
        if ext == "properties":
            lang = "properties"
        out.write(f"```{lang}\n")
        try:
            with open(full_path, "r", encoding="utf-8") as src:
                out.write(src.read().rstrip())
        except Exception as e:
            out.write(f"// Error reading: {e}")
        out.write("\n```\n\n")

print(f"Successfully updated {context_file} with {len(collected_files)} files.")
