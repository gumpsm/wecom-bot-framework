import re

def extract_text(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    clean = re.sub(r"<script[^>]*>[\s\S]*?</script>", "", content)
    clean = re.sub(r"<style[^>]*>[\s\S]*?</style>", "", clean)
    clean = clean.replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&").replace("&quot;", "\"")
    text = re.sub(r"<[^>]+>", "\n", clean)
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    return "\n".join(lines)

for name in ["101463", "101468"]:
    text = extract_text(r"I:\.codex_wecom\docs\\" + name + "-rendered.html")
    lines = text.split("\n")
    doc_lines = []
    in_doc = False
    for l in lines:
        if len(l) > 30 and ("智能机器人" in l or "API" in l):
            in_doc = True
        if in_doc and len(l) > 3:
            doc_lines.append(l)
        if in_doc and "文档内容是否有帮助" in l:
            break
    full_text = "\n".join(doc_lines)
    outpath = r"I:\.codex_wecom\docs\\" + name + "-text.txt"
    with open(outpath, "w", encoding="utf-8") as f:
        f.write(full_text)
    print("[" + name + "] Saved " + str(len(full_text)) + " chars")
