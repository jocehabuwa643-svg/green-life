import re
import sys
import time
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HERE = Path(__file__).resolve().parent
SNIP = (HERE / "dev-banner.html").read_text(encoding="utf-8").strip()
MARK = 'id="dev-banner"'
NEEDLE = "Хотите такой же сайт"
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
LINK = '<link rel="stylesheet" href="css/dev-banner.css?v=%s">' % int(time.time())


class Tree(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text = text
        self.lines = [0] + [m.end() for m in re.finditer("\n", text)]
        self.stack, self.nodes, self.hit = [], [], None

    def off(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def _node(self, tag, attrs):
        n = {"tag": tag, "start": self.off(), "end": None, "attrs": dict(attrs)}
        self.nodes.append(n)
        return n

    def handle_starttag(self, tag, attrs):
        n = self._node(tag, attrs)
        if tag in VOID:
            n["end"] = n["start"] + len(self.get_starttag_text())
        else:
            self.stack.append(n)

    def handle_startendtag(self, tag, attrs):
        n = self._node(tag, attrs)
        n["end"] = n["start"] + len(self.get_starttag_text())

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]["tag"] == tag:
                e = self.text.index(">", self.off()) + 1
                for n in self.stack[i:]:
                    n["end"] = e
                del self.stack[i:]
                return

    def handle_data(self, data):
        if self.hit is None and NEEDLE in data:
            self.hit = list(self.stack)


def find_block(html):
    t = Tree(html)
    t.feed(html)
    t.close()
    if not t.hit:
        raise SystemExit("old credit block not found")
    for n in t.hit:
        if n["tag"] in ("html", "body", "main", "footer", "header") or n["end"] is None:
            continue
        txt = re.sub(r"\s+", " ", re.sub(r"<[^>]*>", " ", html[n["start"]:n["end"]]))
        if len(txt) <= 400 and "Гордеев" in txt:
            inner = [m for m in t.nodes if m["start"] >= n["start"] and (m["end"] or 0) <= n["end"]]
            names = set()
            for m in inner:
                names.update(m["attrs"].get("class", "").split())
                if m["attrs"].get("id"):
                    names.add(m["attrs"]["id"])
            return n["start"], n["end"], names
    raise SystemExit("could not isolate old credit block")


def used_names(html):
    s = set()
    for m in re.finditer(r'(?:class|id)="([^"]*)"', html):
        s.update(m.group(1).split())
    return s


def split_top(css):
    out, i, n = [], 0, len(css)
    while i < n:
        j = i
        while j < n:
            if css.startswith("/*", j):
                k = css.find("*/", j + 2)
                j = n if k < 0 else k + 2
                continue
            if css[j] in "{;":
                break
            j += 1
        if j >= n:
            out.append((css[i:], None))
            break
        if css[j] == ";":
            out.append((css[i:j + 1], None))
            i = j + 1
            continue
        depth, k = 1, j + 1
        while k < n and depth:
            if css.startswith("/*", k):
                m = css.find("*/", k + 2)
                k = n if m < 0 else m + 2
                continue
            depth += (css[k] == "{") - (css[k] == "}")
            k += 1
        out.append((css[i:j], css[j + 1:k - 1]))
        i = k
    return out


def strip_c(s):
    return re.sub(r"/\*.*?\*/", "", s, flags=re.S)


def hit(sel, names):
    return any(re.search(r"[.#]" + re.escape(c) + r"(?![\w-])", sel) for c in names)


def filt(css, names, dropped):
    out = []
    for pre, body in split_top(css):
        if body is None:
            out.append(pre)
            continue
        head = strip_c(pre).strip()
        if "keyframes" in head.split(" ")[0] or head.startswith("@font-face"):
            out.append(pre + "{" + body + "}")
            continue
        if head.startswith("@"):
            nb = filt(body, names, dropped)
            if strip_c(nb).strip():
                out.append(pre + "{" + nb + "}")
            continue
        parts = head.split(",")
        keep = [p for p in parts if not hit(p, names)]
        if len(keep) == len(parts):
            out.append(pre + "{" + body + "}")
            continue
        dropped.append(body)
        if keep:
            cm = re.match(r"\s*(?:/\*.*?\*/\s*)*", pre, flags=re.S).group(0)
            out.append(cm + ",".join(k.strip() for k in keep) + "{" + body + "}")
    return "".join(out)


def clean_css(css, names):
    dropped = []
    css2 = filt(css, names, dropped)
    tokens = set(re.findall(r"[\w-]+", " ".join(re.findall(r"animation(?:-name)?\s*:\s*([^;}]+)", " ".join(dropped)))))
    chunks = split_top(css2)
    rest = "".join(p + ("{" + b + "}" if b is not None else "") for p, b in chunks if "keyframes" not in strip_c(p))
    out = []
    for p, b in chunks:
        m = re.search(r"keyframes\s+([\w-]+)", strip_c(p))
        if m and b is not None and m.group(1) in tokens and not re.search(r"(?<![\w-])" + re.escape(m.group(1)) + r"(?![\w-])", rest):
            continue
        out.append(p + ("{" + b + "}" if b is not None else ""))
    return "".join(out)


def patch_index():
    f = ROOT / "index.html"
    html = f.read_text(encoding="utf-8")
    if MARK in html:
        return
    s, e, names = find_block(html)
    names -= used_names(html[:s] + html[e:])
    html = html[:s] + SNIP + html[e:]
    if "dev-banner.css" not in html:
        html = html.replace("</head>", LINK + "\n</head>", 1)
    f.write_text(html, encoding="utf-8")
    c = ROOT / "css" / "main.css"
    old = c.read_text(encoding="utf-8")
    new = clean_css(old, names) if names else old
    if new != old:
        c.write_text(new, encoding="utf-8")
    print("removed classes:", sorted(names))


def patch_build():
    f = ROOT / "src" / "build.mjs"
    if not f.exists():
        return
    t = f.read_text(encoding="utf-8")
    if MARK in t or "</footer>" not in t or "`" in SNIP or "${" in SNIP:
        return
    t = re.sub(r'<link[^>]*css/main\.css[^>]*>', lambda m: m.group(0) + "\n" + m.group(0).replace("main.css", "dev-banner.css"), t, count=1)
    i = t.rfind("</footer>") + len("</footer>")
    f.write_text(t[:i] + "\n" + SNIP + t[i:], encoding="utf-8")


if __name__ == "__main__":
    patch_index()
    try:
        patch_build()
    except Exception as ex:
        print("build.mjs skipped:", ex, file=sys.stderr)
