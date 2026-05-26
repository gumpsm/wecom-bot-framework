import re

with open(r"I:\.codex_wecom\docs\101032-rendered.html", "r", encoding="utf-8") as f:
    content = f.read()

# Remove scripts and styles
clean = re.sub(r"<script[^>]*>[\s\S]*?</script>", "", content)
clean = re.sub(r"<style[^>]*>[\s\S]*?</style>", "", clean)
clean = clean.replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
text = re.sub(r"<[^>]+>", "\n", clean)
lines = [l.strip() for l in text.split("\n") if l.strip() and len(l.strip()) > 3]

# Find the main content - look for template card types
doc_lines = []
in_doc = False
for l in lines:
    # Find the actual card type content after the sidebar nav
    if "text_notice" in l and len(l) < 50:
        in_doc = True
    if in_doc:
        doc_lines.append(l)
    if in_doc and "文档内容是否有帮助" in l:
        break

# If that didn't work, try a broader search
if len(doc_lines) < 50:
    doc_lines = []
    for l in lines:
        if any(kw in l for kw in ["模板卡片", "text_notice", "news_notice", "button_interaction", "vote_interaction", "multiple_interaction", "card_type"]):
            doc_lines.append(l)

full_text = "\n".join(doc_lines)
with open(r"I:\.codex_wecom\docs\101032-text.txt", "w", encoding="utf-8") as f:
    f.write(full_text)
print("Extracted " + str(len(full_text)) + " chars")
print(full_text[:3000])
