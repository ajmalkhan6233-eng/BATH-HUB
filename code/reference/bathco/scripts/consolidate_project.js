// BATHCO COMMAND — Project consolidation
// Walks the project tree and writes every config/schema/source file into one
// text file on the Desktop, separated by "FILE: <relative path>" headers.
//
// USAGE: node scripts/consolidate_project.js

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(os.homedir(), 'Desktop', 'BATHCO_COMPLETE_PROJECT.txt');

// Directories to skip entirely, wherever they appear in the tree.
const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.expo', 'backups']);

// Specific files to skip (generated lock files + anything holding live secrets).
const EXCLUDED_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.env', '.env.txt']);

// Included by extension, plus .env.example by exact name.
const INCLUDED_EXT = new Set(['.js', '.json', '.sql']);
const INCLUDED_NAMES = new Set(['.env.example']);

function shouldInclude(fileName) {
  if (EXCLUDED_FILES.has(fileName)) return false;
  if (INCLUDED_NAMES.has(fileName)) return true;
  return INCLUDED_EXT.has(path.extname(fileName).toLowerCase());
}

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), files);
    } else if (entry.isFile()) {
      if (shouldInclude(entry.name)) {
        files.push(path.join(dir, entry.name));
      }
    }
  }
  return files;
}

function main() {
  const files = walk(ROOT, []).sort();

  const out = fs.createWriteStream(OUTPUT, { encoding: 'utf8' });
  const report = { total: files.length, written: 0, jsonErrors: [], readErrors: [] };

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (err) {
      report.readErrors.push(`${rel}: ${err.message}`);
      continue;
    }

    if (path.extname(file).toLowerCase() === '.json') {
      try {
        JSON.parse(content);
      } catch (err) {
        report.jsonErrors.push(`${rel}: ${err.message}`);
      }
    }

    out.write('// ==========================================\n');
    out.write(`// FILE: ${rel}\n`);
    out.write('// ==========================================\n');
    out.write(content);
    if (!content.endsWith('\n')) out.write('\n');
    out.write('\n');
    report.written++;
  }

  out.end();

  out.on('finish', () => {
    const stats = fs.statSync(OUTPUT);
    console.log(`Wrote ${report.written} of ${report.total} files to:`);
    console.log(OUTPUT);
    console.log(`Output size: ${(stats.size / 1024).toFixed(1)} KB`);

    if (report.readErrors.length) {
      console.log(`\nFiles that failed to read (${report.readErrors.length}):`);
      report.readErrors.forEach(e => console.log(`  - ${e}`));
    }
    if (report.jsonErrors.length) {
      console.log(`\nJSON files with parse errors (${report.jsonErrors.length}):`);
      report.jsonErrors.forEach(e => console.log(`  - ${e}`));
    } else {
      console.log('\nAll included .json files parsed cleanly.');
    }
  });
}

main();
