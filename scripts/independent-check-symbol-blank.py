#!/usr/bin/env python3
"""獨立驗證 stage-A 生成嘅「符號填空」題目。

★ 完全唔用 subagent 寫嘅 solve.js —— 自己由題目文字 parse，用線性求解精確判斷唯一性。
   目的：偵測「自己驗自己」嘅循環論證。
"""
import json
import re
from collections import Counter, defaultdict

DOMAIN = range(1, 201)          # 正整數，排除 0
TOK = re.compile(r"\d+|[^\s\d()+*\-/=]+|[()+*\-/=]")


def tokenize(s):
    s = s.replace("×", "*").replace("−", "-").replace("－", "-").replace("÷", "/")
    return TOK.findall(s)


def to_py(tokens, assign):
    out = []
    for t in tokens:
        if t in "()+*-/":
            out.append(t)
        elif t.isdigit():
            out.append(t)
        else:
            out.append(str(assign[t]))
    return "".join(out)


def ev(tokens, assign):
    return eval(to_py(tokens, assign))   # noqa: S307 — 我們自己控制嘅運算式


def linear_coeffs(tokens, others, probe):
    """將運算式表示為 c + m*f（f = 唯一自由符號）。probe = {其他符號: 已固定值}"""
    f = others[0]
    v1 = ev(tokens, {**probe, f: 1})
    v2 = ev(tokens, {**probe, f: 2})
    m = v2 - v1
    c = v1 - m
    return c, m


def exists_free(lhs_t, rhs_t, others, probe, domain=DOMAIN):
    """喺 others（自由符號）之下，有冇賦值令 LHS == RHS？"""
    if not others:
        return ev(lhs_t, probe) == ev(rhs_t, probe)
    if len(others) == 1:
        cL, mL = linear_coeffs(lhs_t, others, probe)
        cR, mR = linear_coeffs(rhs_t, others, probe)
        if mL == mR:
            return cL == cR                      # 與 f 無關
        num, den = cR - cL, mL - mR
        if den == 0 or num % den != 0:
            return False
        return num // den in domain
    # 2+ 個自由符號：縮細域 brute force（本設計最多 1 個，呢度係保險）
    import itertools
    for combo in itertools.product(range(1, 41), repeat=len(others)):
        a = {**probe, **dict(zip(others, combo))}
        if ev(lhs_t, a) == ev(rhs_t, a):
            return True
    return False


def determined_values(sym, syms, lhs_t, rhs_t):
    """sym 嘅值域（所有令等式有可能成立嘅候選值）"""
    others = [s for s in syms if s != sym]
    out = []
    for v in DOMAIN:
        if exists_free(lhs_t, rhs_t, others, {**{o: 1 for o in others}, sym: v} if not others else {sym: v}):
            # 注意：others 為空時 probe 只需要 sym
            pass
    return out


def determined_values2(sym, syms, lhs_t, rhs_t):
    others = [s for s in syms if s != sym]
    hits = []
    for v in DOMAIN:
        probe = {sym: v}
        if exists_free(lhs_t, rhs_t, others, probe):
            hits.append(v)
    return hits


rows = []
with open("/tmp/sb_dump.jsonl", encoding="utf-8") as fh:
    for line in fh:
        line = line.strip()
        if line:
            rows.append(json.loads(line))

print(f"讀入 {len(rows)} 條題目\n")

bad_pe = []          # 連 parse 都唔得 / 唔止一個 '='
bad_multi = []       # 多過一個符號被唯一確定（= 6-解 bug class）
bad_wrong = []       # 佢報嘅答案唔係唯一解
bad_none = []        # 冇任何符號被唯一確定
by_level = defaultdict(lambda: {"n": 0, "ok": 0})
level_syms = defaultdict(set)

for r in rows:
    txt, ans, lv = r["q"], str(r["ans"]).strip(), r["level"]
    by_level[lv]["n"] += 1
    if txt.count("=") != 1:
        bad_pe.append((lv, txt, ans, "'='唔止一個"))
        continue
    lhs, rhs = txt.split("=")
    lhs_t, rhs_t = tokenize(lhs), tokenize(rhs)
    syms = sorted({t for t in lhs_t + rhs_t if not t.isdigit() and t not in "()+*-/"})
    level_syms[lv].add("".join(syms))
    if not syms:
        bad_pe.append((lv, txt, ans, "冇符號"))
        continue

    det = {}
    for s in syms:
        hs = determined_values2(s, syms, lhs_t, rhs_t)
        if len(hs) == 1:
            det[s] = hs[0]

    if len(det) == 0:
        bad_none.append((lv, txt, ans, "冇符號被唯一確定"))
    elif len(det) > 1:
        bad_multi.append((lv, txt, ans, f"多過一個被確定: {det}"))
    else:
        only_sym, only_val = next(iter(det.items()))
        if str(only_val) != ans:
            bad_wrong.append((lv, txt, ans, f"實際唯一解 = {only_val}"))
        else:
            by_level[lv]["ok"] += 1

print("=== 每級統計 ===")
for lv in sorted(by_level):
    d = by_level[lv]
    print(f"  L{lv}: {d['n']:>5} 題 | ✅ 通過 {d['ok']:>5} | 符號組合 {sorted(level_syms[lv])}")

print(f"\n=== 結果 ===")
tot_bad = len(bad_pe) + len(bad_multi) + len(bad_wrong) + len(bad_none)
print(f"parse 失敗        : {len(bad_pe)}")
print(f"多過一個被確定 ★★ : {len(bad_multi)}")
print(f"答案唔係唯一解    : {len(bad_wrong)}")
print(f"冇符號被確定      : {len(bad_none)}")
print(f"總問題數          : {tot_bad}")

for name, lst in [("多過一個被確定", bad_multi), ("答案唔係唯一解", bad_wrong),
                  ("冇符號被確定", bad_none), ("parse 失敗", bad_pe)]:
    if lst:
        print(f"\n--- {name}（最多示 5 條）---")
        for lv, txt, ans, why in lst[:5]:
            print(f"  L{lv}: {txt}  （佢報 {ans}）→ {why}")
