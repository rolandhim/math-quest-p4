#!/usr/bin/env python3
"""獨立檢查 Stage D0 嘅教學欄位品質 —— 唔用 verify-schema.mjs。

重點：S1–S4 只驗「欄位存在／型別對／唔洩漏答案」，
      驗唔到「estimate 係唔係真係有用」、「hint 同題目級別夾唔夾」。
"""
import json
import re
import subprocess
from collections import Counter, defaultdict

NODE = r"""
import('./src/gen/registry.js').then(m => {
  const fs = require('fs');
  const out = [];
  for (const tpl of m.TEMPLATES) {
    for (let s = 0; s < 400; s++) {
      try {
        const q = m.generateQuestion(s, { template: tpl.id });
        out.push({ t: tpl.id, lvl: q.level ?? null, q: q.question, ans: String(q.answer),
                   ad: q.answerDisplay, est: q.estimate, hint: q.hint,
                   hintL1: q.hintLevel1, cm: q.commonMistake,
                   kind: q.answerKind || 'number', opts: q.options, ops: q.operands });
      } catch (e) {}
    }
  }
  fs.writeFileSync('/tmp/d0_dump.jsonl', out.map(o => JSON.stringify(o)).join('\n'));
  console.log('dumped ' + out.length);
});
"""
print(subprocess.run(["node", "-e", NODE], capture_output=True, text=True,
                     cwd="/home/hermes/agent-workspace/projects/math-quest-p4").stdout.strip())

rows = [json.loads(l) for l in open("/tmp/d0_dump.jsonl", encoding="utf-8") if l.strip()]
print(f"讀入 {len(rows)} 條\n")

# ── 中文數量級講法 → 數值範圍 ──────────────────────────────
MAG = {"十": (10, 99), "百": (100, 999), "千": (1000, 9999), "萬": (10000, 99999)}
NUM_WORDS = [("幾十", "十"), ("幾百", "百"), ("幾千", "千"), ("幾萬", "萬")]

bad_note_num = []      # note 完全冇具體數字（泛泛而談）
bad_mag = []           # note 講嘅量級同 estimate.value 唔一致
bad_far = []           # estimate.value 同真實答案差太遠（數量級都唔同）
bad_hint = []          # hint 同 hintLevel1 唔一致
bad_cm = []            # commonMistake 空 / 太短 / 就係答案
hint_by_level = defaultdict(Counter)
stats = defaultdict(lambda: {"n": 0, "note_has_num": 0})
far_by_type = Counter()

for r in rows:
    t = r["t"]
    est = r["est"] or {}
    note = str(est.get("note") or "")
    val = est.get("value")
    stats[t]["n"] += 1

    # 1) note 有冇具體數字
    if re.search(r"\d", note):
        stats[t]["note_has_num"] += 1
    else:
        bad_note_num.append((t, r["q"][:60], note))

    # 2) note 講嘅量級 vs estimate.value
    for word, unit in NUM_WORDS:
        if word in note and isinstance(val, (int, float)):
            lo, hi = MAG[unit]
            if not (lo <= val <= hi):
                bad_mag.append((t, note, val))
            break

    # 3) estimate.value 同真實答案嘅數量級
    try:
        a = int(r["ans"])
    except (TypeError, ValueError):
        a = None
    if a and isinstance(val, (int, float)) and a > 0 and val > 0:
        if max(a, val) / min(a, val) > 10:
            bad_far.append((t, r["q"][:55], f"ans={a} 但 estimate={val}"))

    # 4) hint 同 hintLevel1 一致
    if r["hintL1"] is not None and r["hint"] != r["hintL1"]:
        bad_hint.append((t, r["hint"], r["hintL1"]))

    # 5) commonMistake 品質（⚠️ 唔可以用任意長度門檻 —— 廣東話 7 個字可以好清楚）
    cm = str(r["cm"] or "")
    if not cm.strip() or len(cm) < 5 or cm.strip() == r["ans"] or r["ans"] in cm.split():
        bad_cm.append((t, r["q"][:50], cm))

    if t == "symbol-blank" and r["lvl"] is not None:
        hint_by_level[r["lvl"]][str(r["hint"])] += 1
    far_by_type[t] += 1 if (a and isinstance(val, (int, float)) and a > 0 and val > 0
                            and max(a, val) / min(a, val) > 10) else 0

print("=== estimate.note 有具體數字嘅比率（越高越有用）===")
for t in sorted(stats):
    n, k = stats[t]["n"], stats[t]["note_has_num"]
    bar = "✅" if k / n > 0.9 else ("⚠️" if k / n > 0.5 else "❌")
    print(f"  {bar} {t:<20} {k:>4}/{n:<4} ({k/n*100:5.1f}%)")

def show(title, lst, limit=4, fmt=lambda x: x):
    print(f"\n=== {title}：{len(lst)} 個 ===")
    for x in lst[:limit]:
        print("   " + fmt(x))

show("note 冇任何具體數字（泛泛而談）", bad_note_num,
     fmt=lambda x: f"[{x[0]}] note=\"{x[2]}\"")
show("note 講嘅量級同 estimate.value 矛盾", bad_mag,
     fmt=lambda x: f"[{x[0]}] \"{x[1]}\" 但 value={x[2]}")
show("estimate 同真實答案差 >10 倍", bad_far, fmt=lambda x: f"[{x[0]}] {x[2]}")
print("   ↑ 分佈（結構題嘅答案係「空格值」，同整個算式嘅量級本質上唔同 → 屬預期）:")
for t, c in far_by_type.most_common():
    print(f"      {t:<20} {c:>4}")
show("hint ≠ hintLevel1", bad_hint, fmt=lambda x: f"[{x[0]}] hint=\"{x[1]}\" vs L1=\"{x[2]}\"")
show("commonMistake 有問題（太短／含答案）", bad_cm, fmt=lambda x: f"[{x[0]}] \"{x[2]}\"")

print("\n=== symbol-blank 每級嘅 hint（睇有冇配錯級）===")
for lvl in sorted(hint_by_level):
    for h, c in hint_by_level[lvl].most_common(2):
        print(f"  L{lvl} ({c:>3} 題): {h}")
