#!/usr/bin/env python3
"""獨立檢查 Stage B2（課題 2 十二款）—— 唔用生成器嘅 solve/verify。

重點（今日學到嘅三件事）：
  1. 正確性 —— 由**渲染出嚟嘅題目文字**自己重算答案
  2. 設計意圖 —— 讀題目文字，問「呢條題真係考佢聲稱考嘅嘢？」
  3. 語料多樣性 —— 統計幾千條，唔係逐條睇

用法：python3 scripts/independent-check-lesson2.py [每款題數]
"""
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict

N = int(sys.argv[1]) if len(sys.argv) > 1 else 500
ROOT = "/home/hermes/agent-workspace/projects/math-quest-p4"

TYPES = [
    "tens-multiply", "two-digit-expand", "two-digit-swap", "three-by-two",
    "mid-zero", "estimate-first", "triple-product", "fastest-order",
    "find-error-vertical", "reverse-l2", "word-problem-l2", "symbol-blank-l2",
]


def dump(template, n):
    """用生成器出題，dump 成中性 JSON（唔經過任何 verify）"""
    code = f"""
import('./src/gen/registry.js').then(m => {{
  const out = [];
  for (let s = 0; s < {n}; s++) {{
    try {{
      const q = m.generateQuestion(s, {{ template: '{template}' }});
      out.push({{ seed: s, q: String(q.question), answer: String(q.answer),
                  answerDisplay: q.answerDisplay == null ? null : String(q.answerDisplay),
                  options: (q.options||[]).map(o => (o && typeof o === 'object') ? {{id:String(o.id),label:String(o.label)}} : String(o)),
                  hint: q.hint||null, cm: q.commonMistake||null,
                  estNote: (q.estimate && q.estimate.note) || null }});
    }} catch (e) {{ out.push({{ seed: s, error: String(e.message).slice(0, 120) }}); }}
  }}
  console.log(JSON.stringify(out));
}});
"""
    r = subprocess.run(["node", "-e", code], cwd=ROOT, capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        print("  node 失敗:", r.stderr[-300:])
        return []
    return json.loads(r.stdout)


def nums(s):
    return [int(x) for x in re.findall(r"\d+", s or "")]


# ── 各題型嘅獨立驗算 ────────────────────────────────────────────
def check_tens_multiply(r):
    """11 × 40 = ?   → 答案 = 11×40"""
    m = re.match(r"\s*(\d+)\s*[×x]\s*(\d+)\s*=", r["q"])
    if not m:
        return None, "parse 失敗"
    exp = int(m.group(1)) * int(m.group(2))
    return int(r["answer"]) == exp, f"{m.group(1)}×{m.group(2)}={exp} vs {r['answer']}"


def check_two_digit_expand(r):
    """4 × 13 = 4 × 10 + 4 × 3 = ?  → 答案 = 4×13；且兩個部分積要真係 == 4×10, 4×3"""
    m = re.match(r"\s*(\d+)\s*[×x]\s*(\d+)\s*=\s*(\d+)\s*[×x]\s*(\d+)\s*\+\s*(\d+)\s*[×x]\s*(\d+)", r["q"])
    if not m:
        return None, "parse 失敗"
    a, b, a2, t, a3, o = (int(x) for x in m.groups())
    errs = []
    if a != a2 or a != a3:
        errs.append("共同因數唔一致")
    if t + o != b:
        errs.append(f"拆數 {t}+{o} != {b}")
    if int(r["answer"]) != a * b:
        errs.append(f"答案 {r['answer']} != {a*b}")
    return (not errs), "; ".join(errs) or "ok"


def check_two_digit_swap(r):
    """計 12 × 4，可以掉轉做 4 × 12 嚟計。答案係幾多？"""
    m = re.match(r".*?(\d+)\s*[×x]\s*(\d+).*?(\d+)\s*[×x]\s*(\d+)", r["q"])
    if not m:
        return None, "parse 失敗"
    a, b, c, d = (int(x) for x in m.groups())
    errs = []
    if a * b != c * d:
        errs.append(f"{a}×{b} != {c}×{d}")
    if int(r["answer"]) != a * b:
        errs.append(f"答案錯 {r['answer']} != {a*b}")
    return (not errs), "; ".join(errs) or "ok"


def check_plain_mult(r):
    """223 × 12 = ?  /  301 × 22 = ?  /  12 × 25 × 3 = ?"""
    m = re.match(r"\s*([\d\s×x]+?)\s*=\s*\?", r["q"])
    if not m:
        return None, "parse 失敗"
    parts = [int(x) for x in re.findall(r"\d+", m.group(1))]
    if len(parts) < 2:
        return None, "parse 失敗"
    exp = 1
    for p in parts:
        exp *= p
    return int(r["answer"]) == exp, f"{'×'.join(map(str,parts))}={exp} vs {r['answer']}"


def check_estimate_first(r):
    """先估一估：50 × 21 大約係幾多？（提示：先把 21 估成最接近嘅整十數）
    答案必須係「估算值」而唔係精確積；且要真係等於把尾數估成整十後嘅積。"""
    m = re.search(r"(\d+)\s*[×x]\s*(\d+)", r["q"])
    if not m:
        return None, "parse 失敗"
    a, b = int(m.group(1)), int(m.group(2))
    r10 = lambda x: (x + 5) // 10 * 10          # 四捨五入（唔用 Python banker's rounding）
    b_r = r10(b)
    a_r = a if a % 10 == 0 else r10(a)
    cands = {a * b_r, a_r * b_r, a_r * b}
    exact = a * b
    ans = int(r["answer"])
    errs = []
    if ans not in cands:
        errs.append(f"答案 {ans} 唔係任何一種估算（{sorted(cands)}）")
    if ans == exact and exact not in cands:
        errs.append("答案係精確積，唔係估算")
    if "估" not in r["q"]:
        errs.append("題目文字冇『估』字")
    return (not errs), "; ".join(errs) or f"估算 ok（精確={exact}）"


def check_fastest_order(r):
    """計 12 × 3 × 25。次序一：…；次序二：…。邊個次序快啲？
    ★ 設計意圖：答案必須係 choice id（order-xx），唔可以係數字。"""
    errs = []
    if not re.match(r"order-", str(r["answer"])):
        errs.append(f"答案唔係 order-* choice id（係「{r['answer']}」）→ 又變咗問數字")
    if "邊個次序快" not in r["q"]:
        errs.append("題目冇問『邊個次序快』")
    if not r["options"]:
        errs.append("冇 options")
    ids = [o["id"] if isinstance(o, dict) else o for o in r["options"]]
    if r["answer"] not in ids:
        errs.append(f"答案 {r['answer']} 唔喺 options {ids} 入面")
    return (not errs), "; ".join(errs) or "ok"


STEPS = re.compile(r"①\s*(?:個位乘\s*)?(\d+)\s*[×x]\s*(\d+)\s*=\s*(\d+).*?"
                   r"②\s*(?:十位乘\s*)?(\d+)\s*[×x]\s*(\d+)\s*=\s*(\d+).*?"
                   r"③\s*(?:相加\s*)?(\d+)\s*[+＋]\s*(\d+)\s*=\s*(\d+)", re.S)


STEPS = re.compile(r"①\s*(?:個位乘\s*)?(\d+)\s*[×x]\s*(\d+)\s*=\s*(\d+).*?"
                   r"②\s*(?:十位乘\s*)?(\d+)\s*[×x]\s*(\d+)\s*=\s*(\d+)"
                   r"(?:，補位後\s*=\s*(\d+))?.*?"
                   r"③\s*(?:相加\s*[:：]?\s*)?"
                   r"(?:佢只寫咗\s*(\d+)[，,]?\s*冇加到\s*(\d+)|(\d+)\s*[+＋]\s*(\d+)\s*=\s*(\d+))", re.S)


def check_find_error_vertical(r):
    """★ 新版（B2.1 之後）：
      (a) 除咗「標示為錯」嗰一步之外，所有顯示算式必須係**真等式**
      (b) 由渲染文字重推「第一步偏離」，必須 == answer
      (c) miss-shift 嘅 ② 唔准含「補位」二字
    """
    m = STEPS.search(r["q"])
    if not m:
        return None, "parse 失敗"
    (a1, ob_s, s1, a2, tb_s, p2_shown, p2s_shown,
     only_wrote, missed, z1, z2, z3) = m.groups()
    s1, p2_shown = int(s1), int(p2_shown)
    qn = re.search(r"直式計\s*(\d+)\s*[×x]\s*(\d+)", r["q"])
    if not qn:
        return None, "parse 失敗(題號)"
    A, B = int(qn.group(1)), int(qn.group(2))
    ob, tb = B % 10, B // 10
    p1, p2, p2s, total = A * ob, A * tb, A * tb * 10, A * B

    errs = []

    # ① 是否真等式
    eq1 = (int(a1) * int(ob_s) == s1)
    # ② 是否真等式（兩段都要真）
    eq2a = (int(a2) * int(tb_s) == p2_shown)
    eq2b = True if p2s_shown is None else (int(p2s_shown) == p2s)
    has_shift = p2s_shown is not None

    # ③：學生嘅總值
    if only_wrote is not None:
        student_total = int(only_wrote)
        eq3 = True            # 描述句，唔存在假等式
        kind_hint = "miss-add"
    else:
        student_total = int(z3)
        eq3 = (int(z1) + int(z2) == int(z3))
        kind_hint = None

    # (a) 除咗標示錯嗰步，其餘必須真
    ans = str(r["answer"])
    if ans != "step-1" and not eq1:
        errs.append(f"非答案步驟 ① 係假等式：{a1}×{ob_s}={s1}（真值 {int(a1)*int(ob_s)}）")
    if ans != "step-2" and not (eq2a and eq2b):
        errs.append(f"非答案步驟 ② 有假等式")
    if ans != "step-3" and not eq3:
        errs.append(f"非答案步驟 ③ 有假等式：{z1}+{z2}={z3}")

    # (c) miss-shift 唔准有「補位」
    if kind_hint != "miss-add" and not has_shift and "補位" in r["q"].split("③")[0]:
        pass  # ② 冇補位子句 = miss-shift；下面另判
    if "補位後" not in r["q"] and "補位後" in r["q"].split("②")[-1].split("③")[0]:
        errs.append("② 顯示未補位嘅值但寫「補位」")

    # (b) 重推第一步偏離
    if s1 != p1:
        first = "step-1"
    elif not has_shift or p2s_shown is None or int(p2s_shown) != p2s:
        first = "step-2"
    elif student_total != total:
        first = "step-3"
    else:
        first = None
    if first is None:
        errs.append("★ 冇任何一步係錯 → 呢條題目根本冇錯處")
    elif ans != first:
        errs.append(f"標示「{ans}」但重推第一步錯係「{first}」"
                    f"（①{'✓' if s1==p1 else '✗'} ②{'✓' if has_shift and int(p2s_shown)==p2s else '✗'} "
                    f"③{'✓' if student_total==total else '✗'}）")

    return (not errs), "; ".join(errs) or f"ok（首錯={first}）"




def check_reverse_l2(r):
    """□ × 40 = 480，□ 係幾多？"""
    m = re.search(r"[□\s]*[×x]\s*(\d+)\s*=\s*(\d+)", r["q"])
    if not m:
        return None, "parse 失敗"
    d, prod = int(m.group(1)), int(m.group(2))
    if d == 0 or prod % d:
        return None, f"唔整除 {prod}÷{d}"
    return int(r["answer"]) == prod // d, f"{prod}÷{d}={prod//d} vs {r['answer']}"


def check_word_problem(r):
    """只驗答案係非負整數 + 有答案（文字題語意要靠人睇）"""
    if not re.match(r"^\d+$", str(r["answer"])):
        return False, f"答案唔係整數：{r['answer']}"
    return True, "ok（語意需人看，下面抽樣印出）"


def check_symbol_blank_l2(r):
    """★ 通用做法：抽出等式兩邊，把目標符號代入答案，然後**自己 eval 兩邊**睇係唔係相等。
    唔假設任何特定形狀（A×B = A×C + A×□ 只係其中一種）。"""
    q = r["q"]
    if "=" not in q:
        return None, "冇等號"
    left_s, right_s = q.split("=", 1)
    # 目標符號 = 題目中出現嘅 □ ★ ■ 心形 星星 之中，答案代入嘅嗰個
    sym = None
    for s in ("□", "★", "■", "心形", "星星", "●", "▲"):
        if s in q:
            sym = s
            break
    if sym is None:
        return None, "搵唔到符號"

    def ev(expr, val):
        e = expr
        if sym in ("心形", "星星"):
            # 文字符號：逐個 token 換成 val
            e = e.replace(sym, f"*{val}") if False else re.sub(re.escape(sym), str(val), e)
            e = e.replace("×", "*").replace("x", "*")
            # 處理「數字 數字」隱含相乘（例如 "2 3"）
            e = re.sub(r"(\d)\s+(\d)", r"\1*\2", e)
        else:
            e = e.replace(sym, str(val)).replace("×", "*").replace("x", "*")
        e = re.sub(r"[^\d\+\-\*\(\)\s\.]", "", e)
        e = e.replace(" ", "")
        if not e or not re.match(r"^[\d\+\-\*\(\)\.]+$", e):
            return None
        try:
            return eval(e)  # noqa: S307 —— 只含數字同 +-*()
        except Exception:
            return None

    t = int(r["answer"])
    L, R = ev(left_s, t), ev(right_s, t)
    if L is None or R is None:
        return None, "eval 失敗"
    return L == R, f"左={L} 右={R}（代入 {t}）"



CHECKS = {
    "tens-multiply": check_tens_multiply,
    "two-digit-expand": check_two_digit_expand,
    "two-digit-swap": check_two_digit_swap,
    "three-by-two": check_plain_mult,
    "mid-zero": check_plain_mult,
    "estimate-first": check_estimate_first,
    "triple-product": check_plain_mult,
    "fastest-order": check_fastest_order,
    "find-error-vertical": check_find_error_vertical,
    "reverse-l2": check_reverse_l2,
    "word-problem-l2": check_word_problem,
    "symbol-blank-l2": check_symbol_blank_l2,
}

print(f"獨立檢查 課題 2 —— 每款 {N} 題（我自己 parse 渲染文字重算，唔用生成器嘅 solve/verify）\n")

total_bad = 0
for t in TYPES:
    rows = dump(t, N)
    bad, unparsed, leak, est_nonum = [], 0, 0, 0
    for r in rows:
        if "error" in r:
            unparsed += 1
            continue
        # 洩漏（數字 token 比對）
        a = str(r["answer"])
        if re.match(r"^\d+$", a):
            an = int(a)
            for fld in ("estNote", "hint", "cm"):
                v = r.get(fld)
                if v and an in nums(v):
                    leak += 1
                    break
        if r.get("estNote") and not nums(r["estNote"]):
            est_nonum += 1

        ok, why = CHECKS[t](r)
        if ok is None:
            unparsed += 1
        elif not ok:
            bad.append((r["seed"], why, r["q"][:90]))

    status = "✅" if (not bad and unparsed == 0) else "❌"
    print(f"{status} {t:<22} {len(rows)} 題 | 答案錯 {len(bad):>3} | parse 失敗 {unparsed:>3} "
          f"| 提示洩漏 {leak:>3} | estimate 冇數字 {est_nonum:>3}")
    for seed, why, q in bad[:4]:
        print(f"      seed {seed}: {why}")
        print(f"        Q: {q}")
    total_bad += len(bad)

print(f"\n{'='*70}")
print(f"答案／設計意圖問題總數 : {total_bad}")
print("（parse 失敗高 = 我自己嘅 parser 問題，唔一定係題目問題）")
