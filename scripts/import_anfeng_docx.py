#!/usr/bin/env python3
# 从 /tmp/anfeng.docx 解析《谙风》12 篇，写入 posts/ 并给既有文章补 series / seriesOrder
# 下载：curl -fsSL -o /tmp/anfeng.docx "https://cpti.oss-ap-northeast-1.aliyuncs.com/assets/%E8%B0%99%E9%A3%8E.docx"

import hashlib
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
WORK = Path(__file__).resolve().parents[1]
POSTS = WORK / "posts"
DOCX = Path("/tmp/anfeng.docx")
SERIES = "谙风"
DATE_NEW = "2019-06-05T08:00:00+08:00"


def para_text(p):
    parts = []
    for t in p.findall(".//w:t", NS):
        if t.text:
            parts.append(t.text)
        if t.tail:
            parts.append(t.tail)
    return "".join(parts).strip()


def para_style(p):
    ppr = p.find("w:pPr", NS)
    if ppr is None:
        return None
    ps = ppr.find("w:pStyle", NS)
    if ps is None:
        return None
    return ps.get(f"{{{NS['w']}}}val")


def norm_title(s):
    s = (s or "").strip()
    s = re.sub(r"\s+", "", s)
    for a, b in [("，", ""), (",", ""), ("。", ""), (".", ""), ("：", ":"), ("？", ""), ("?", ""), ("|", ""), ("｜", "")]:
        s = s.replace(a, b)
    return s.lower()


def load_existing():
    out = {}
    for fp in POSTS.glob("*.md"):
        raw = fp.read_text(encoding="utf-8")
        m = re.match(r"^---\n([\s\S]*?)\n---", raw)
        if not m:
            continue
        fm = m.group(1)
        tm = re.search(r"^title:\s*(.+)$", fm, re.M)
        if not tm:
            continue
        t = tm.group(1).strip()
        if (t.startswith('"') and t.endswith('"')) or (t.startswith("'") and t.endswith("'")):
            t = t[1:-1]
        out[norm_title(t)] = fp
    return out


def split_chapters():
    with zipfile.ZipFile(DOCX) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    body = root.find("w:body", NS)
    chapters = []
    cur_title = None
    cur_paras = []

    def flush():
        nonlocal cur_title, cur_paras
        if cur_title:
            chapters.append((cur_title, cur_paras[:]))
        cur_paras = []

    for p in body.findall("w:p", NS):
        st = para_style(p)
        tx = para_text(p)
        if st == "2" and tx:
            flush()
            cur_title = tx
        else:
            if cur_title is None:
                continue
            if tx:
                cur_paras.append(tx)
    flush()
    return chapters


def fm_escape(s):
    s = str(s).replace("\\", "\\\\").replace('"', '\\"')
    return '"' + s + '"'


def make_summary(paras, n=220):
    plain = "".join(paras)[:800]
    plain = re.sub(r"\s+", " ", plain).strip()
    return (plain[: n] + "…") if len(plain) > n else plain


def slug_for_new(title: str) -> str:
    h = hashlib.md5(("anfeng|" + title).encode("utf-8")).hexdigest()[:8]
    # 文件名可读 + 短 hash，避免碰撞
    core = re.sub(r'[\\/:*?"<>|]', "-", title)
    core = core.replace(" ", "")[:32]
    return f"{core}-{h}"


def body_markdown(paras):
    # 每段单独成段；原文无 Markdown 格式
    return "\n\n".join(paras) + "\n"


def patch_series(path: Path, order: int):
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"^(---\n)([\s\S]*?)(\n---\n)", raw)
    if not m:
        raise SystemExit(f"bad fm: {path}")
    pre, fm, post = m.group(1), m.group(2), m.group(3)
    lines = fm.split("\n")
    filtered = [ln for ln in lines if not ln.startswith("series:") and not ln.startswith("seriesOrder:")]
    out_fm = []
    inserted = False
    for ln in filtered:
        out_fm.append(ln)
        if ln.startswith("title:") and not inserted:
            out_fm.append(f'series: "{SERIES}"')
            out_fm.append(f"seriesOrder: {order}")
            inserted = True
    if not inserted:
        out_fm.insert(0, f'series: "{SERIES}"')
        out_fm.insert(1, f"seriesOrder: {order}")
    new_raw = pre + "\n".join(out_fm) + post + raw[m.end() :]
    path.write_text(new_raw, encoding="utf-8")


def write_new(title: str, paras: list, order: int):
    slug = slug_for_new(title)
    fp = POSTS / f"{slug}.md"
    if fp.exists():
        slug = slug + "x"
        fp = POSTS / f"{slug}.md"
    summary = make_summary(paras)
    fm = f"""---
title: {fm_escape(title)}
date: {DATE_NEW}
updated: {DATE_NEW}
series: "{SERIES}"
seriesOrder: {order}
author: "邻家酒肆"
tags:
  - "谙风"
  - "随想"
summary: {fm_escape(summary)}
---

"""
    fp.write_text(fm + body_markdown(paras), encoding="utf-8")
    print("NEW", fp.name, "order", order)


def main():
    if not DOCX.is_file():
        raise SystemExit(f"missing {DOCX}, curl docx first")
    existing = load_existing()
    chapters = split_chapters()
    for order, (title, paras) in enumerate(chapters, start=1):
        key = norm_title(title)
        hit = existing.get(key)
        if hit:
            patch_series(hit, order)
            print("PATCH", hit.name, "order", order, title)
        else:
            write_new(title, paras, order)


if __name__ == "__main__":
    main()
