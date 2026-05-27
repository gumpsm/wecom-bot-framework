import fs from 'fs';
import path from 'path';

var SECRET_PATTERNS = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/, name: '疑似 API Key' },
  { pattern: /ghp_[a-zA-Z0-9]{30,}/, name: '疑似 GitHub Token' },
];

var EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'coverage', 'logs', 'outputs'];

function scanDir(dir) {
  var issues = [];
  var entries = fs.readdirSync(dir, { withFileTypes: true });
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.indexOf(entry.name) === -1) issues = issues.concat(scanDir(fullPath));
      continue;
    }
    if (entry.name === '.env' || (entry.name.endsWith('.env') && entry.name.indexOf('.example') === -1)) continue;
    var ext = path.extname(entry.name).toLowerCase();
    var ok = ['.ts','.js','.json','.md','.html','.yml','.yaml','.sh','.py','.env.example','.txt'];
    if (ok.indexOf(ext) === -1) continue;
    try {
      var c = fs.readFileSync(fullPath, 'utf-8');
      for (var j = 0; j < SECRET_PATTERNS.length; j++) {
        if (SECRET_PATTERNS[j].pattern.test(c)) issues.push(path.relative(process.cwd(), fullPath) + ': ' + SECRET_PATTERNS[j].name);
      }
      var m = c.match(/WECOM.*SECRET[=:]\s*['\x22]?([a-zA-Z0-9_-]{30,})/g);
      if (m) {
        for (var k = 0; k < m.length; k++) {
          if (m[k].indexOf('your_') === -1 && m[k].indexOf('xxx') === -1) issues.push(path.relative(process.cwd(), fullPath) + ': real WECOM_SECRET');
        }
      }
    } catch (e) {}
  }
  return issues;
}

console.log('=== Pre-commit Security Scan ===');
var issues = scanDir(process.cwd());
if (issues.length === 0) {
  console.log('PASS - No hardcoded secrets found');
  process.exit(0);
} else {
  console.log('FAIL - ' + issues.length + ' issue(s):');
  issues.forEach(function(x) { console.log('  ' + x); });
  process.exit(1);
}
