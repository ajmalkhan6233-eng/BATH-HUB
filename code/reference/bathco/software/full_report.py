import os, sys, subprocess, glob, urllib.request
from datetime import datetime

desk = r"C:\Users\1st Choice\Desktop\CLAUDE_FULL_REPORT.txt"
lines = []
lines.append('='*60)
lines.append('   CLAUDE CODE FULL SYSTEM REPORT')
lines.append(f'   Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
lines.append('='*60)

def run(cmd):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, shell=True)
        return (r.stdout + r.stderr).strip() or '(no output)'
    except Exception as e:
        return f'ERROR: {e}'

def section(title):
    lines.append('')
    lines.append(f'## {title}')
    lines.append('-'*40)

section('VERSIONS')
lines.append(f'Claude : {run("claude --version")}')
lines.append(f'Node   : {run("node --version")}')
lines.append(f'npm    : {run("npm --version")}')
lines.append(f'Python : {run("python --version")}')
lines.append(f'Git    : {run("git --version")}')
lines.append(f'Ollama : {run("ollama --version")}')

section('OLLAMA MODELS INSTALLED')
lines.append(run('ollama list'))

section('GLOBAL NPM PACKAGES')
lines.append(run('npm list -g --depth=0'))

section('CLAUDE.MD')
p = r'C:\Users\1st Choice\CLAUDE.md'
if os.path.exists(p):
    lines.append('Found')
    lines.append(open(p, encoding='utf-8').read())
else:
    lines.append('NOT FOUND')

section('SLASH COMMANDS (.claude/commands/)')
cmds = glob.glob(r'C:\Users\1st Choice\.claude\commands\*.md')
if cmds:
    lines += [os.path.basename(c) for c in cmds]
else:
    lines.append('(none)')

section('CLAUDE SETTINGS')
sp = r'C:\Users\1st Choice\.claude\settings.json'
if os.path.exists(sp):
    lines.append(open(sp, encoding='utf-8').read())
else:
    lines.append('(not found)')

section('BATHCO GIT LOG (last 5)')
lines.append(run('git -C "C:\\Users\\1st Choice\\BATHCO" log --oneline -5'))

section('BATHCO GIT STATUS')
lines.append(run('git -C "C:\\Users\\1st Choice\\BATHCO" status --short'))

section('BATHCO APP STATUS')
try:
    urllib.request.urlopen('http://localhost:8000', timeout=3)
    lines.append('http://localhost:8000 -- ONLINE')
except Exception:
    lines.append('http://localhost:8000 -- OFFLINE')

section('BATHCO .ENV (secrets masked)')
env_path = r'C:\Users\1st Choice\BATHCO\software\app\.env'
if os.path.exists(env_path):
    for line in open(env_path, encoding='utf-8'):
        l = line.rstrip()
        if any(x in l for x in ['KEY', 'PASSWORD', 'PASS']):
            k = l.split('=')[0]
            lines.append(f'{k}=***MASKED***')
        else:
            lines.append(l)
else:
    lines.append('(not found)')

section('TASK QUEUE')
lines.append('[x] Git installed and BATHCO repo initialized')
lines.append('[x] bulk_import.py run -- 29 days imported')
lines.append('[x] ANTHROPIC_API_KEY set in .env')
lines.append('[x] llama3.2 pulled via Ollama')
lines.append('[x] App running at localhost:8000')
lines.append('[ ] Push BATHCO to GitHub (need repo URL)')
lines.append('[ ] Pull mistral + nomic-embed-text models')
lines.append('[ ] Import n8n workflows')
lines.append('[ ] Connect Gmail MCP OAuth')

lines.append('')
lines.append('='*60)
lines.append('   END OF REPORT')
lines.append('='*60)

with open(desk, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
print(f'DONE! Report saved to Desktop: CLAUDE_FULL_REPORT.txt')
