import { join, resolve, relative, isAbsolute } from "stdlib/path";
import type { Course } from "../domain/model.ts";

const ignoredDirectories = new Set([".git", ".quarto", ".gradle", ".idea", ".vscode", "build", "target", "out", "node_modules", "__pycache__", "_generated", "_book", "_site", "_output", "_downloads"]);
const ignoredFile = /(?:\.class|\.pyc|\.DS_Store)$/i;
function within(root: string, path: string): string {
  const value = resolve(root, path), rel = relative(root, value);
  if (rel === ".." || rel.startsWith("../") || rel.startsWith("..\\") || isAbsolute(rel)) throw new Error(`Archive path outside project: ${path}`);
  return value;
}
async function noSymlinks(root: string, path: string): Promise<void> {
  const rel = relative(root, within(root, path));
  let part = root;
  for (const name of rel.split(/[\\/]/).filter(Boolean)) {
    part = join(part, name);
    if ((await Deno.lstat(part)).isSymlink) throw new Error(`Archive source contains a symbolic link: ${part}`);
  }
}
export interface ArchiveEntry { name: string; bytes: Uint8Array }
export async function starterFiles(root: string, virtualProject: string): Promise<ArchiveEntry[]> {
  if (!virtualProject.startsWith("/") || virtualProject.startsWith("//")) throw new Error("Archive project must be course-relative");
  const student = within(root, join(virtualProject.slice(1), "student"));
  await noSymlinks(root, student);
  if (!(await Deno.stat(student)).isDirectory) throw new Error(`Missing student directory: ${student}`);
  const entries: ArchiveEntry[] = [];
  async function walk(directory: string): Promise<void> {
    const children = Array.from(await Array.fromAsync(Deno.readDir(directory))).sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const child of children) {
      const path = join(directory, child.name);
      if (child.isSymlink) throw new Error(`Archive source contains a symbolic link: ${path}`);
      if (child.isDirectory) { if (!ignoredDirectories.has(child.name)) await walk(path); }
      else if (child.isFile && !ignoredFile.test(child.name) && child.name !== ".gitkeep") {
        entries.push({name: relative(student, path).replaceAll("\\", "/"), bytes: await Deno.readFile(path)});
      }
    }
  }
  await walk(student);
  if (!entries.length) throw new Error(`Student project is empty: ${virtualProject}`);
  return entries;
}
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Reproducible ZIP (STORE, UTF-8 names, 1980-01-01), without an external archiver. */
export function zip(entries: ArchiveEntry[]): Uint8Array {
  const files: Uint8Array[] = [], directory: Uint8Array[] = [];
  let offset = 0, centralSize = 0;
  if (entries.length > 65535) throw new Error("ZIP64 archives are not supported");
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name), size = entry.bytes.length, crc = crc32(entry.bytes);
    if (name.length > 65535 || size > 0xffffffff) throw new Error("ZIP entry exceeds supported size");
    const local = new Uint8Array(30 + name.length), lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x800, true);
    lv.setUint16(12, 33, true); lv.setUint32(14, crc, true); lv.setUint32(18, size, true); lv.setUint32(22, size, true); lv.setUint16(26, name.length, true); local.set(name, 30);
    files.push(local, entry.bytes);
    const central = new Uint8Array(46 + name.length), cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x800, true);
    cv.setUint16(14, 33, true); cv.setUint32(16, crc, true); cv.setUint32(20, size, true); cv.setUint32(24, size, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); central.set(name, 46);
    directory.push(central); centralSize += central.length; offset += local.length + size;
  }
  if (offset + centralSize > 0xffffffff) throw new Error("ZIP64 archives are not supported");
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true); ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + end.length); let cursor = 0;
  for (const chunk of [...files, ...directory, end]) { result.set(chunk, cursor); cursor += chunk.length; }
  return result;
}
export async function clearDownloads(root: string, output: string): Promise<void> {
  const destination = within(resolve(root, output), "_downloads");
  try { await Deno.remove(destination, {recursive: true}); }
  catch (error) { if (!(error instanceof Deno.errors.NotFound)) throw error; }
}
export async function publishDownloads(root: string, output: string, model: Course): Promise<void> {
  const directory = within(resolve(root, output), "_downloads");
  const archives = [];
  for (const request of model.downloads ?? []) {
    const exercise = model.exercises.find((item) => item.id === request.exercise && item.source === request.source);
    if (!exercise || !exercise.project) throw new Error(`Invalid project download: ${request.exercise}`);
    if (!/^exr-[a-z0-9][a-z0-9-]*$/.test(exercise.id)) throw new Error(`Unsafe archive ID: ${exercise.id}`);
    archives.push({name: exercise.id + ".zip", bytes: zip(await starterFiles(root, exercise.project))});
  }
  await clearDownloads(root, output);
  if (archives.length) await Deno.mkdir(directory, {recursive: true});
  for (const archive of archives) await Deno.writeFile(join(directory, archive.name), archive.bytes);
}
