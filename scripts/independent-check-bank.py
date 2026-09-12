#!/usr/bin/env python3
"""★ 驗「題庫入面凍結咗嘅內容」—— 唔係驗生成器。

為什麼要另寫一支：
  之前所有獨立驗證（independent-check-lesson1/2.py）都係叫 generateQuestion() 出題來驗，
  即係驗「生成器」；但小朋友睇到嘅係**題庫 JSON**。題庫 build 過程、序列化、
  dedupe 任何一步出錯，生成器驗幾多次都唔會發現。

做法：讀 manifest → 讀題庫檔 → 逐條由**題目文字**自己重算答案。
用法：python3 scripts/independent-check-bank.py
"""
import glob
import json
import os
import re
import sys
from collections import Counter, defaultdict

ROOT = "/home/hermes/agent-workspace/projects/math-quest-p4"
BANK = os.path.join(ROOT, "src/data/bank")


def num_tokens(s):
    return [int(x) for x in re.findall(r"\d+", s or "")]


def ev(expr):
    """只准數字同 + - * ( ) —— 安全 eval"""
    e = expr.replace("×", "*").replace("−", "-").replace("–", "-").replace("x", "*")
    e = e.replace("（", "(").replace("）", ")").replace("＝", "=")
    e = re.sub(r"[^\d\+\-\*\(\)\.]", "", e)
    if not e or not re.match(r"^[\d\+\-\*\(\)\.]+$", e):
        return None
    try:
        return eval(e)  # noqa: S307
    except Exception:
        return None


def core_expr(text):
    """抽出「=?」之前嘅算式（最後一個 = 之後、最終嗰段）
    ⚠️ 一定要包含 U+2212「−」同「–」—— 題目用嘅係真減號，唔係 hyphen。
    （我第一次漏咗，令 91 條課題 1 減法題被誤報「答案錯」。）"""
    cls = r"[\d\(\)\+\-\*×−–\s]"
    m = re.search(cls + r"+\s*=\s*[?？]", text)
    if m:
        return m.group(0).split("=")[0]
    m = re.search(r"=\s*(" + cls + r"+?)\s*=\s*[?？]", text)
    if m:
        return m.group(1)
    return None


def check_numeric_from_text(q):
    """答案係數字嘅題目：由文字重算，睇有冇一條算式等於答案"""
    text = q["question"]
    ans_raw = str(q["answer"])
    if not re.match(r"^\d+$", ans_raw):
        return None, "非數字答案"
    ans = int(ans_raw)

    # 形狀 1：「EXPR = ?」
    e = core_expr(text)
    if e:
        v = ev(e)
        if v is not None:
            return (v == ans), f"eval({e.strip()})={v} vs {ans}"

    # 形狀 1b：「計 A × B，可以掉轉做 …」
    m = re.search(r"計\s*(\d+)\s*[×x]\s*(\d+)", text)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        return (ans == a * b), f"{a}×{b}={a*b} vs {ans}"

    # 形狀 1c：估算題「先估一估：A × B 大約係幾多？」→ 答案要係估算（唔係精確積）
    m = re.search(r"(\d+)\s*[×x]\s*(\d+)", text)
    if m and "估" in text:
        a, b = int(m.group(1)), int(m.group(2))
        r10 = lambda x: (x + 5) // 10 * 10
        cands = {a * r10(b), r10(a) * r10(b), r10(a) * b}
        return (ans in cands), f"答案 {ans} 唔係估算候選 {sorted(cands)}"


    # 形狀 2：「□ × D = P」
    m = re.search(r"[□★■]\s*[×x]\s*(\d+)\s*=\s*(\d+)", text)
    if m:
        d, p = int(m.group(1)), int(m.group(2))
        if d and p % d == 0:
            return (ans == p // d), f"{p}÷{d}={p//d} vs {ans}"

    # 形狀 3：符號填空（代入答案後兩邊要相等）
    if "=" in text and re.search(r"[□★■心形星星]", text):
        parts = text.split("=")
        sym = next((s for s in ("□", "★", "■", "心形", "星星") if s in text), None)
        if sym and len(parts) >= 2:
            def sub_eval(expr):
                t = re.sub(re.escape(sym), str(ans), expr)
                t = re.sub(r"(\d)\s+(\d)", r"\1*\2", t)
                return ev(t)
            L = sub_eval(parts[0])
            R = sub_eval(parts[1])
            if L is not None and R is not None:
                return (L == R), f"代入 {ans}：左={L} 右={R}"

    # 形狀 4：文字題／估算 —— 起碼要係正整數，而且冇明顯矛盾
    if ans < 0:
        return False, f"答案係負數 {ans}"
    return None, "無法由文字直接重算（需要人手／專用 parser）"


def check_choice(q):
    """choice 題：答案必須係 options 入面一個 id，而且唔可以係純數字"""
    ans = str(q["answer"])
    opts = q.get("options") or []
    ids = [o.get("id") if isinstance(o, dict) else str(o) for o in opts]
    if not opts:
        return False, "choice 題但冇 options"
    if ans not in ids:
        return False, f"答案 {ans} 唔喺 options {ids}"
    if re.match(r"^\d+$", ans):
        return False, f"★ choice 題嘅答案係純數字「{ans}」→ 可能又變咗問數字"
    ad = str(q.get("answerDisplay") or "")
    if re.match(r"^\d+$", ad):
        return False, f"★ answerDisplay「{ad}」係純數字"
    return True, "ok"


def main():
    man_path = os.path.join(BANK, "manifest.json")
    if not os.path.exists(man_path):
        print("❌ 冇 manifest.json")
        sys.exit(1)
    man = json.load(open(man_path, encoding="utf-8"))
    print(f"manifest: {json.dumps({k: v for k, v in man.items() if k != 'lessons'}, ensure_ascii=False)[:160]}")

    all_ids, all_texts = [], []
    grand = Counter()
    per_type = defaultdict(lambda: Counter())
    samples = defaultdict(list)

    for lesson, info in man["lessons"].items():
        path = os.path.join(BANK, info["file"])
        if not os.path.exists(path):
            print(f"❌ 題庫檔唔存在：{info['file']}")
            sys.exit(1)
        d = json.load(open(path, encoding="utf-8"))
        items = []
        for topic, by_diff in d["byTopic"].items():
            for diff, by_type in by_diff.items():
                for t, arr in by_type.items():
                    for q in arr:
                        q2 = dict(q)
                        q2["_type"] = q.get("template") or q.get("angle") or t
                        q2["_diff"] = diff
                        items.append(q2)
        print(f"\n課題 {lesson}: {info['file']} → 實際載入 {len(items)} 條（manifest 報 {info['count']}）")

        for q in items:
            t = q["_type"]
            per_type[t]["n"] += 1
            all_ids.append(q.get("id"))
            all_texts.append(q["question"])

            # schema 必備欄位
            for f in ("id", "question", "answer", "estimate", "hint", "commonMistake", "answerDisplay"):
                if q.get(f) in (None, ""):
                    per_type[t]["missing_field"] += 1
                    if len(samples["missing"]) < 3:
                        samples["missing"].append(f"[{t}] {q.get('id')} 缺 {f}")

            # estimate.note 要有數字
            note = (q.get("estimate") or {}).get("note") or ""
            if not num_tokens(note):
                per_type[t]["est_nonum"] += 1

            # 洩漏（數字 token 比對；answerDisplay 唔算 —— 佢本身就係答案嘅顯示）
            a = str(q["answer"])
            if re.match(r"^\d+$", a):
                an = int(a)
                for fld, label in ((note, "estimate.note"), (q.get("hint") or "", "hint"),
                                   (q.get("commonMistake") or "", "commonMistake")):
                    if an in num_tokens(fld):
                        per_type[t]["leak"] += 1
                        if len(samples["leak"]) < 3:
                            samples["leak"].append(f"[{t}] {q.get('id')} {label} 含答案 {an}")
                        break

            # 答案正確性
            if q.get("answerKind") == "choice" or (q.get("options") and not re.match(r"^\d+$", a)):
                ok, why = check_choice(q)
            else:
                ok, why = check_numeric_from_text(q)
            if ok is None:
                per_type[t]["unverifiable"] += 1
            elif not ok:
                per_type[t]["wrong"] += 1
                if len(samples["wrong"]) < 6:
                    samples["wrong"].append(f"[{t}] {q.get('id')} 答「{q['answer']}」← {why}\n      Q: {q['question'][:110]}")

    # 跨課題 id 唯一 / 題幹重複
    dup_ids = [k for k, v in Counter(all_ids).items() if v > 1]
    dup_texts = [k for k, v in Counter(all_texts).items() if v > 1]

    print(f"\n{'='*76}")
    print(f"總題數            : {len(all_ids)}")
    print(f"id 重複           : {len(dup_ids)}  {'✅' if not dup_ids else '❌ ' + str(dup_ids[:5])}")
    print(f"題幹重複          : {len(dup_texts)}  {'✅' if not dup_texts else '❌'}")
    print(f"題幹 distinct 比率: {(len(set(all_texts))/len(all_texts)*100):.1f}%")

    print(f"\n{'類型':<24}{'題數':>5}{'答案錯':>7}{'無法獨立判':>11}{'洩漏':>6}{'est冇數':>8}{'缺欄':>6}")
    tw = tu = tl = te = tm = 0
    for t in sorted(per_type):
        c = per_type[t]
        print(f"{t:<24}{c['n']:>5}{c['wrong']:>7}{c['unverifiable']:>11}{c['leak']:>6}{c['est_nonum']:>8}{c['missing_field']:>6}")
        tw += c["wrong"]; tu += c["unverifiable"]; tl += c["leak"]; te += c["est_nonum"]; tm += c["missing_field"]
    print(f"{'合計':<24}{len(all_ids):>5}{tw:>7}{tu:>11}{tl:>6}{te:>8}{tm:>6}")

    if samples["wrong"]:
        print("\n=== 答案錯（頭 6 條）===")
        for s in samples["wrong"]:
            print("  " + s)
    if samples["leak"]:
        print("\n=== 洩漏（頭 3 條）===")
        for s in samples["leak"]:
            print("  " + s)
    if samples["missing"]:
        print("\n=== 缺欄位（頭 3 條）===")
        for s in samples["missing"]:
            print("  " + s)

    ok = (tw == 0 and tl == 0 and not dup_ids and not dup_texts and tm == 0)
    print(f"\n{'✅ 題庫內容通過' if ok else '❌ 題庫有問題'}")
    sys.exit(0 if ok else 1)


main()
