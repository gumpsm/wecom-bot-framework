import re

with open(r"I:\.codex_wecom\docs\101468-rendered.html", "r", encoding="utf-8") as f:
    content = f.read()

# Look for the main document content area
# The page structure likely has a content div with the actual API doc
patterns = [
    r'<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]{200,}?)</div>\s*</div>\s*</div>',
    r'<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)</div>\s*</div>\s*</div>',
    r'<div[^>]*class="[^"]*document[^"]*"[^>]*>([\s\S]*?)</div>\s*</div>\s*</div>',
]

for p in patterns:
    m = re.search(p, content)
    if m:
        print(f"FOUND pattern, length: {len(m.group(1))}")
        # extract text
        text = re.sub(r'<[^>]+>', '\n', m.group(1))
        lines = [l.strip() for l in text.split('\n') if l.strip() and len(l.strip()) > 3]
        print('\n'.join(lines[:30]))
        break
else:
    # Try to find the main content differently
    # Find "API模式机器人" in content and look around it
    idx = content.find('API模式机器人文档使用说明')
    idx2 = content.find('API模式机器人文档使用说明', idx + 10)
    if idx2 > idx + 200:
        chunk = content[idx2:idx2+3000]
        # extract text
        text = re.sub(r'<[^>]+>', '\n', chunk)
        lines = [l.strip() for l in text.split('\n') if l.strip() and len(l.strip()) > 3]
        print("Second occurrence content:")
        print('\n'.join(lines[:40]))
    else:
        print("No second occurrence found, checking around first occurrence:")
        chunk = content[idx:idx+3000]
        text = re.sub(r'<[^>]+>', '\n', chunk)
        lines = [l.strip() for l in text.split('\n') if l.strip() and len(l.strip()) > 3]
        print('\n'.join(lines[:40]))
