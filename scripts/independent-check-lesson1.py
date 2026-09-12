#!/usr/bin/env python3
"""獨立驗證 B1（課題 1 其餘 10 款）—— 完全唔用佢嘅 verify.js / verify-lesson1.mjs。

方法：由題目**文字**抽數字 → 用我自己寫嘅公式重算答案 → 同佢報嘅答案比對。
另外量度：① 運算數重複（唔同題型撞同一組數字） ② find-error 嘅陷阱值係唔係真錯
"""
import json
import re
import subprocess
from collections import Counter, defaultdict

DUMP = "/tmp/b1_dump.jsonl"

NODE = r"""
import('./src/gen/registry.js').then(m => {
  const fs = require('fs');
  const out = [];
  for (const tpl of m.TEMPLATES) {
    for (let s = 0; s < 600; s++) {
      try {
        const q = m.generateQuestion(s, { template: tpl.id });
        out.push({ t: tpl.id, q: q.question, ans: String(q.answer),
                   op: q.operation, operands: q.operands, type: q.type,
                   options: q.options, ci: q.correctIndex,
                   hint1: q.hintLevel1, hint2: q.hintLevel2 });
      } catch (e) {}
    }
  }
  fs.writeFileSync('/tmp/b1_dump.jsonl', out.map(o => JSON.stringify(o)).join('\n'));
  console.log('dumped ' + out.length);
});
"""
print(subprocess.run(["node", "-e", NODE], capture_output=True, text=True,
                     cwd="/home/hermes/agent-workspace/projects/math-quest-p4").stdout.strip())

rows = [json.loads(l) for l in open(DUMP, encoding="utf-8") if l.strip()]
print(f"讀入 {len(rows)} 條\n")

# ── 我自己嘅公式（由題型語意寫，唔抄佢嘅 code）────────────────────
def my_formula(t, ctx):
    o = ctx["operands"]
    if t in ("forward-expand", "reverse-combine", "fastest",
             "word-to-expression", "find-error"):
        a, b, c = o[0], o[1], o[2]
        return a * (b + c)
    if t == "reverse-subtract":
        a, b, c = o[0], o[1], o[2]
        return a * (b - c)
    if t == "which-property":
        return o[0] * o[1] * o[2]
    if t == "decompose":
        # a × b = (□ − k) × b  →  □ = a + k    ／  a × b = (□ + k) × b  →  □ = a − k
        # ★ 一定要由題目文字讀正負號（我第一次就係喺呢度出錯）
        a, k = o[0], o[2]
        m = re.search(r"\(□\s*([−+\-])\s*\d+", ctx["q"])
        if not m:
            return None
        sign = -1 if m.group(1) in "−-" else +1
        return a - sign * k          # '−' → a+k ；'+' → a−k
    if t == "reverse-unknown":       # □ × a = c  →  □ = c / a
        return o[2] // o[0]
    if t == "fill-blank":            # a × c + b × c = (□) × c  →  a + b
        return o[0] + o[1]
    return None                      # symbol-blank 另有專用驗證（6000 題獨立檢查已過）

# ══════════════════════════════════════════════════════════════
# choice 型（answerKind='choice'，answer 係 id 唔係數字）
# ══════════════════════════════════════════════════════════════
CHOICE_TYPES = {"fastest", "which-property"}

def my_choice_answer(t, ctx):
    """我自己獨立重推 choice 正解（唔抄佢 derive.js 嘅寫法）"""
    o = ctx["operands"]
    if t == "fastest":
        a, b, c = o[0], o[1], o[2]
        sum_ = b + c
        # 我嘅判斷準則（同佢唔同表達）：分開乘要「乘 a 兩次」；先加埋要「乘 sum 一次」。
        # 邊個「唔順」嘅乘法多一次，就邊個慢。
        hard_sep = 0 if a <= 9 else 1          # a 係兩位數 → 兩次都要拆位
        hard_sum = 0 if sum_ % 10 == 0 else (1 if sum_ % 5 == 0 else 2)
        # 兩邊都各自加一次；把「唔順嘅乘法次數」當成本
        cost_sep = 2 * (1 + hard_sep)
        cost_sum = 1 + hard_sum
        # 成本細者勝；平手 → 先加埋（乘少一次）
        return "method-1" if cost_sep < cost_sum else "method-2"
    if t == "which-property":
        # 由題目文字自己判斷形式：連乘 a×b×c → 結合；有共同因數／乘加 → 分配
        txt = ctx["q"]
        has_three_mult = bool(re.search(r"\d+\s*×\s*\d+\s*×\s*\d+", txt))
        has_common_add = bool(re.search(r"\d+\s*×\s*\d+\s*\+\s*\d+\s*×\s*\d+", txt))
        if has_common_add and not has_three_mult:
            return "distributive"
        if has_three_mult and not has_common_add:
            return "associative"
        return None                        # 分辨唔到 → 唔報
    return None

# 答案本身就係「空格」嘅題型 → 文字裡面當然冇答案呢個數，唔可以當錯
ANSWER_IS_BLANK = {"symbol-blank", "decompose", "reverse-unknown", "fill-blank"}
# symbol-blank 嘅「自由符號名義值」唔會出現喺文字 → check A 唔適用（佢有專用 6000 題檢查）
SKIP_CHECK_A = {"symbol-blank"}

def nums(text):
    return [int(x) for x in re.findall(r"\d+", text)]

results = defaultdict(lambda: {"n": 0, "ok": 0, "bad": []})
collide = Counter()
sig = defaultdict(list)
tree_like = defaultdict(set)
hint_leak = []

for r in rows:
    t, q, ans = r["t"], r["q"], r["ans"]
    d = results[t]
    d["n"] += 1

    # ── A. text 裡面嘅數字，同 operands 對得上？（find-error 例外：會多一個錯值）
    tn = nums(q)
    ops = r["operands"] or []
    if t == "find-error":
        pass                                  # 另行驗證
    elif t in SKIP_CHECK_A:
        pass                                  # 自由符號名義值唔會出現喺文字
    elif t in ANSWER_IS_BLANK:
        # 答案就係空格 → 唔會出現喺題目文字；其餘 operands 必須出現
        need = [v for v in ops if v != int(ans)]
        if not all(v in tn for v in need):
            d["bad"].append((q, ans, f"text 數字 {tn} vs operands {ops}（答案係空格，只查其餘）"))
            continue
    else:
        ok_ops = all(v in tn for v in ops) and len(tn) >= len(ops)
        if not ok_ops:
            d["bad"].append((q, ans, f"text 數字 {tn} vs operands {ops}"))
            continue

    # ── B. 用我自己嘅公式／準則重算
    if t in CHOICE_TYPES:
        mine = my_choice_answer(t, r)
        if mine is None:
            d["unverifiable"] = d.get("unverifiable", 0) + 1
            continue
        if mine != ans:
            d["bad"].append((q, ans, f"我獨立推 = {mine}"))
            continue
        # choice 題仲要驗：correctIndex 指中 answer；option id 互不相等
        opts = r.get("options") or []
        ids = [o.get("id") if isinstance(o, dict) else o for o in opts]
        ci = r.get("ci", -1)
        if len(set(ids)) != len(ids):
            d["bad"].append((q, ans, f"option id 有重複: {ids}"))
            continue
        if not (0 <= ci < len(ids)) or ids[ci] != ans:
            d["bad"].append((q, ans, f"correctIndex={ci} 指住 {ids[ci] if 0 <= ci < len(ids) else '?'}"))
            continue
        d["ok"] += 1
        d.setdefault("choice_counts", Counter())[ans] += 1
        continue

    mine = my_formula(t, r)
    if mine is None:
        continue
    if str(mine) != ans:
        d["bad"].append((q, ans, f"我算 = {mine}"))
    else:
        d["ok"] += 1

    # ── C. find-error：錯誤值係唔係真嘅「漏乘」錯？
    if t == "find-error":
        m = re.search(r"=\s*(\d+)\s*\+?\s*(\d*)\s*=\s*(\d+)\s*。", q)
        a, b, c = ops[0], ops[1], ops[2]
        wrong_shown = nums(q)[-1]
        expect_wrong = a * b + c
        d.setdefault("trap_ok", 0)
        if wrong_shown == expect_wrong:
            d["trap_ok"] += 1
        else:
            d["bad"].append((q, ans, f"陷阱值 {wrong_shown} ≠ 漏乘應得 {expect_wrong}"))

    # ── D. 提示有冇洩漏答案（數字）
    for h in (r["hint1"] or "", r["hint2"] or ""):
        if ans in h:
            hint_leak.append((t, q, h))

    # ── E. 運算數撞題
    key = (tuple(sorted(ops)) if ops else None, ans)
    sig[key].append(t)

for t in sorted(results):
    d = results[t]
    if t == "symbol-blank":
        print(f"➖ {t:<20} {d['n']:>4} 題 | 由專用 gate 驗（check:symbol-blank 5000 題）")
        continue
    extra = ""
    if "trap_ok" in d:
        extra += f" | 陷阱真錯 {d['trap_ok']}"
    if "choice_counts" in d:
        tot = sum(d["choice_counts"].values())
        dist = "、".join(f"{k} {v/tot*100:.1f}%" for k, v in d["choice_counts"].most_common())
        extra += f" | 分佈 {dist}"
    if d.get("unverifiable"):
        extra += f" | ⚠️無法獨立判 {d['unverifiable']}"
    flag = "✅" if not d["bad"] and d["ok"] == d["n"] else "❌"
    print(f"{flag} {t:<20} {d['n']:>4} 題 | 重算一致 {d['ok']:>4}{extra} | 問題 {len(d['bad'])}")
    for q, ans, why in d["bad"][:3]:
        print(f"      └ {q[:80]}\n         佢報 {ans} → {why}")

print(f"\n提示洩漏答案 : {len(hint_leak)}")
for t, q, h in hint_leak[:3]:
    print(f"   [{t}] {h}")

# ── F. 撞題分析
multi = {k: v for k, v in sig.items() if k[0] is not None and len(set(v)) > 1}
print(f"\n=== 撞題（同一組數字 + 同一答案，但唔同題型）===")
print(f"唔同題型撞同一組 (數字, 答案) 嘅組數 : {len(multi)}")
cross = Counter()
for k, v in multi.items():
    cross[tuple(sorted(set(v)))] += 1
for combo, cnt in cross.most_common(6):
    print(f"   {cnt:>4} 組 ← {' + '.join(combo)}")
