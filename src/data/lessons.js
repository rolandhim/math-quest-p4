/* ════════════════════════════════════════════════════════════
   mq4 — lessons.js
   課題 metadata + 溫習卡 + 種子題目（今次：課題 1 五題、課題 2 五題）

   ★ 所有答案唔准手寫：
     answer === computeAnswer(operation, operands)
     由 operands 重算，跑 scripts/verify.mjs 逐條驗證。

   課本：《現代小學數學（第二版）》4上A（現代教育研究社）
   ════════════════════════════════════════════════════════════ */

export const BOOK = '現代小學數學(第二版)4上A'

/* ────────────────────────────────────────────────────────────
   computeAnswer —— 由 operands 重算答案
   支援 operation 模板：'a*b', 'a*b+c*d', 'a*b-c*d',
                        'a*b+c*d+e*f', 'a*(b+c)', 'a*b*c', 'a+b', 'a-b'
   自己寫嘅小型算式 parser（加減乘 + 括號），唔用 eval。
   ──────────────────────────────────────────────────────────── */

function tokenize(expr) {
  const tokens = []
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]
    if (ch === ' ' || ch === '\t') {
      i += 1
      continue
    }
    if ('+-*()'.indexOf(ch) !== -1) {
      tokens.push(ch)
      i += 1
      continue
    }
    if (ch >= '0' && ch <= '9') {
      let num = ''
      while (i < expr.length && expr[i] >= '0' && expr[i] <= '9') {
        num += expr[i]
        i += 1
      }
      tokens.push({ num: Number(num) })
      continue
    }
    throw new Error('operation 有唔接受嘅字元：' + ch)
  }
  return tokens
}

function parseExpression(tokens, state) {
  let value = parseTerm(tokens, state)
  while (state.i < tokens.length && (tokens[state.i] === '+' || tokens[state.i] === '-')) {
    const op = tokens[state.i]
    state.i += 1
    const rhs = parseTerm(tokens, state)
    value = op === '+' ? value + rhs : value - rhs
  }
  return value
}

function parseTerm(tokens, state) {
  let value = parseFactor(tokens, state)
  while (state.i < tokens.length && tokens[state.i] === '*') {
    state.i += 1
    const rhs = parseFactor(tokens, state)
    value = value * rhs
  }
  return value
}

function parseFactor(tokens, state) {
  const tok = tokens[state.i]
  if (tok === undefined) throw new Error('operation 寫得唔完整')
  if (tok === '-') {
    state.i += 1
    return -parseFactor(tokens, state)
  }
  if (tok === '(') {
    state.i += 1
    const value = parseExpression(tokens, state)
    if (tokens[state.i] !== ')') throw new Error('operation 括號唔對稱')
    state.i += 1
    return value
  }
  if (typeof tok === 'object' && tok !== null && 'num' in tok) {
    state.i += 1
    return tok.num
  }
  throw new Error('operation 有唔接受嘅 token：' + String(tok))
}

/**
 * 由 operation 模板 + operands 重算答案。
 * @param {string} operation 例如 'a*b+c*d'
 * @param {number[]} operands 例如 [3,24,3,16]
 * @returns {number}
 */
export function computeAnswer(operation, operands) {
  if (typeof operation !== 'string') throw new Error('operation 必須係字串')
  const ops = Array.isArray(operands) ? operands : []
  let expr = operation
  const vars = ['a', 'b', 'c', 'd', 'e', 'f']
  vars.forEach((v, idx) => {
    expr = expr.split(v).join('(' + String(Number(ops[idx] || 0)) + ')')
  })
  if (/[a-f]/.test(expr)) throw new Error('operation 用到未提供嘅 operand：' + operation)
  const tokens = tokenize(expr)
  const state = { i: 0 }
  const value = parseExpression(tokens, state)
  if (state.i !== tokens.length) throw new Error('operation 有剩餘 token：' + operation)
  if (!Number.isFinite(value)) throw new Error('operation 算唔到：' + operation)
  return value
}

/* ────────────────────────────────────────────────────────────
   課題 metadata + 溫習卡
   ──────────────────────────────────────────────────────────── */

export const LESSONS = [
  {
    id: '1',
    unit: '1',
    name: '乘法（一）',
    subtitle: '乘法的性質',
    pages: '6-11',
    methods: [
      { id: 'L1-m1', label: '方法一：正向展開', steps: ['先分開乘', '再加埋'] },
      { id: 'L1-m2', label: '方法二：逆向合併', steps: ['先加埋括號入面', '再一次乘'] },
    ],
    summary: '同一個數分開乘兩次，加起上嚟同「先加埋再一次乘」係一樣嘅。',
    cards: [
      {
        id: 'L1-c1',
        title: '兩組都有同一個數',
        text: 'a×c + b×c 呢兩組都有 c，可以合埋一齊做一次乘：(a+b)×c。',
        pages: '6-7',
        example: '3×24 + 3×16 = 3×(24+16) = 3×40 = 120',
        fill: { prompt: 'a×c + b×c = ( ____ )×c', answer: 'a+b', accepted: ['a+b'] },
      },
      {
        id: 'L1-c2',
        title: '減法一樣得',
        text: 'a×c − b×c 都可以合埋：(a−b)×c。前後都有同一個數就得。',
        pages: '8',
        example: '4×25 − 4×6 = 4×(25−6) = 4×19 = 76',
        fill: { prompt: 'a×c − b×c = ( ____ )×c', answer: 'a-b', accepted: ['a-b', 'a−b'] },
      },
      {
        id: 'L1-c3',
        title: '三個都有同一個數',
        text: '三個乘法式都有同一個數，就三個一齊合。',
        pages: '9',
        example: '7×24 + 7×16 + 7×10 = 7×(24+16+10) = 7×50 = 350',
        fill: { prompt: '7×24 + 7×16 + 7×10 = 7×( ____ )', answer: '50', accepted: ['50'] },
      },
      {
        id: 'L1-c4',
        title: '括號入面要全部乘',
        text: 'a×(b+c) 即係 a×b 加 a×c，兩個數都要乘，唔可以只乘前面嗰個。',
        pages: '10-11',
        example: '3×(2+4) = 3×2 + 3×4 = 6 + 12 = 18',
        fill: { prompt: '3×2 + 3×4 = 3×( ____ )', answer: '6', accepted: ['6'] },
      },
    ],
  },
  {
    id: '2',
    unit: '1',
    name: '乘法（二）',
    subtitle: '乘法的運算',
    pages: '12-24',
    methods: [
      { id: 'L2-m1', label: '方法一：補零法', steps: ['先當整十數係個位數', '計完補返 0'] },
      { id: 'L2-m2', label: '方法二：展開法', steps: ['拆成十位同個位', '分別乘再相加'] },
    ],
    summary: '乘以整十數可以補零；唔係整十就拆開做，再估一估數值合唔合理。',
    cards: [
      {
        id: 'L2-c1',
        title: '乘以整十數：補零法',
        text: '乘 20、30、40……可以當佢係 2、3、4 咁乘，計完喺尾巴補一個 0。',
        pages: '12-14',
        example: '16×20 → 16×2 = 32 → 補一個 0 → 320',
        fill: { prompt: '16×20 = 16×2 之後補 ____ 個 0', answer: '1', accepted: ['1', '一'] },
      },
      {
        id: 'L2-c2',
        title: '估算先行',
        text: '計之前先估一估。如果計出嚟同估算差好遠，多數係位值或者補零出咗事。',
        pages: '15-17',
        example: '70×34：70×30 已經係 2100，所以答案一定係二千幾',
        fill: { prompt: '70×34 估算大約係 70×30 = ____', answer: '2100', accepted: ['2100'] },
      },
      {
        id: 'L2-c3',
        title: '拆位展開法',
        text: '兩位數乘兩位數，可以拆成「乘十位 + 乘個位」兩步，加埋就係答案。',
        pages: '18-21',
        example: '17×46 = 17×40 + 17×6 = 680 + 102 = 782',
        fill: { prompt: '17×46 = 17×40 + 17× ____', answer: '6', accepted: ['6'] },
      },
      {
        id: 'L2-c4',
        title: '進位要記住',
        text: '直式入面個位滿十就要進位，進咗嘅數唔可以漏。',
        pages: '22-24',
        example: '17×6 = 102 → 個位寫 2，十位進 10',
        fill: { prompt: '17×6 = 102，個位寫 ____', answer: '2', accepted: ['2'] },
      },
    ],
  },
]

export function getLesson(id) {
  const key = String(id)
  return LESSONS.find((l) => l.id === key) || null
}

/* ────────────────────────────────────────────────────────────
   種子題目（10 條：課題 1 五題、課題 2 五題）
   每條嘅 answer 一定要等於 computeAnswer(operation, operands)
   ──────────────────────────────────────────────────────────── */

export const QUESTIONS = [
  /* ── 課題 1：乘法的性質 ────────────────────────────── */
  {
    id: 'N1-bas-001',
    lesson: '1',
    unit: '1',
    topic: 'distributive',
    difficulty: 'basic',
    difficultyTags: ['forward', 'decompose'],
    type: 'type-answer',
    question: '3×24 + 3×16 = ?',
    answer: '120',
    generatedAnswer: '120',
    operands: [3, 24, 3, 16],
    operation: 'a*b+c*d',
    options: [],
    correctIndex: -1,
    acceptedAnswers: ['120'],
    estimate: { value: 120, operands: [3, 40], note: '3×40 大約 120' },
    hint: '兩組都有同一個數。',
    explanationSteps: [
      '先睇兩組：3×24 同 3×16，兩組都有 3。',
      '分開計：3×24 = 72，3×16 = 48。',
      '加埋：72 + 48 = 120。',
      '合埋一齊更快：3×(24+16) = 3×40 = 120。',
    ],
    methods: [
      { id: 'N1-bas-001-m1', label: '方法一：正向展開', steps: ['3×24 = 72', '3×16 = 48', '72 + 48 = 120'] },
      { id: 'N1-bas-001-m2', label: '方法二：逆向合併', steps: ['24 + 16 = 40', '3×40 = 120'] },
    ],
    commonMistake: '只計咗前面嗰組 3×24，後面嗰組唔記得加。',
    source: { book: BOOK, lesson: '1', pages: '6-11' },
  },
  {
    id: 'N1-bas-002',
    lesson: '1',
    unit: '1',
    topic: 'distributive',
    difficulty: 'basic',
    difficultyTags: ['reverse', 'combine'],
    type: 'mc',
    question: '23×17 + 23×13 = ?',
    answer: '690',
    generatedAnswer: '690',
    operands: [23, 17, 23, 13],
    operation: 'a*b+c*d',
    options: ['69', '690', '1380', '6900'],
    correctIndex: 1,
    acceptedAnswers: ['690'],
    estimate: { value: 690, operands: [23, 30], note: '23×30 大約 690' },
    hint: '先睇兩個乘法有咩一樣。',
    explanationSteps: [
      '兩組都有 23，可以合埋。',
      '17 + 13 = 30。',
      '23×30 = 690。',
      '用分開計覆核：391 + 299 = 690。',
    ],
    methods: [
      { id: 'N1-bas-002-m1', label: '方法一：正向展開', steps: ['23×17 = 391', '23×13 = 299', '391 + 299 = 690'] },
      { id: 'N1-bas-002-m2', label: '方法二：逆向合併', steps: ['17 + 13 = 30', '23×30 = 690'] },
    ],
    commonMistake: '補零時多補或少補一個 0（69 或 6900）。',
    source: { book: BOOK, lesson: '1', pages: '6-11' },
  },
  {
    id: 'N1-bas-003',
    lesson: '1',
    unit: '1',
    topic: 'distributive',
    difficulty: 'advanced',
    difficultyTags: ['subtract'],
    type: 'type-answer',
    question: '4×25 − 4×6 = ?',
    answer: '76',
    generatedAnswer: '76',
    operands: [4, 25, 4, 6],
    operation: 'a*b-c*d',
    options: [],
    correctIndex: -1,
    acceptedAnswers: ['76'],
    estimate: { value: 80, operands: [4, 20], note: '4×20 = 80，答案應該係幾十' },
    hint: '兩邊都減咗同一個數。',
    explanationSteps: [
      '兩組都有 4。',
      '分開計：4×25 = 100，4×6 = 24。',
      '相減：100 − 24 = 76。',
      '合埋一齊：4×(25−6) = 4×19 = 76。',
    ],
    methods: [
      { id: 'N1-bas-003-m1', label: '方法一：正向展開', steps: ['4×25 = 100', '4×6 = 24', '100 − 24 = 76'] },
      { id: 'N1-bas-003-m2', label: '方法二：逆向合併', steps: ['25 − 6 = 19', '4×19 = 76'] },
    ],
    commonMistake: '當咗做加法，或者括號入面減錯次序。',
    source: { book: BOOK, lesson: '1', pages: '8' },
  },
  {
    id: 'N1-adv-004',
    lesson: '1',
    unit: '1',
    topic: 'distributive',
    difficulty: 'advanced',
    difficultyTags: ['three-terms', 'combine'],
    type: 'type-answer',
    question: '7×24 + 7×16 + 7×10 = ?',
    answer: '350',
    generatedAnswer: '350',
    operands: [7, 24, 7, 16, 7, 10],
    operation: 'a*b+c*d+e*f',
    options: [],
    correctIndex: -1,
    acceptedAnswers: ['350'],
    estimate: { value: 350, operands: [7, 50], note: '7×50 大約 350' },
    hint: '三個乘法可唔可以合成一個？',
    explanationSteps: [
      '三個乘法式都有 7。',
      '把後面三個數加埋：24 + 16 + 10 = 50。',
      '7×50 = 350。',
      '三項同一項一樣做法，唔使逐個乘。',
    ],
    methods: [
      { id: 'N1-adv-004-m1', label: '方法一：逐個乘再加', steps: ['7×24 = 168', '7×16 = 112', '7×10 = 70', '168 + 112 + 70 = 350'] },
      { id: 'N1-adv-004-m2', label: '方法二：逆向合併', steps: ['24 + 16 + 10 = 50', '7×50 = 350'] },
    ],
    commonMistake: '只合併了頭兩項，第三項漏咗或者加錯。',
    source: { book: BOOK, lesson: '1', pages: '9' },
  },
  {
    id: 'N1-adv-005',
    lesson: '1',
    unit: '1',
    topic: 'distributive',
    difficulty: 'advanced',
    difficultyTags: ['find-error'],
    type: 'type-answer',
    question: '有同學寫：「3×(2+4) = 6+4 = 10」。呢個係唔啱嘅，正確答案應該係幾多？',
    answer: '18',
    generatedAnswer: '18',
    operands: [3, 2, 4],
    operation: 'a*(b+c)',
    options: [],
    correctIndex: -1,
    acceptedAnswers: ['18'],
    estimate: { value: 18, operands: [3, 6], note: '3×6 大約 18' },
    hint: '括號入面每個數都要處理。',
    explanationSteps: [
      '佢寫 6+4，即係只乘咗 3×2，冇乘 3×4。',
      '正確做法：3×2 = 6，3×4 = 12。',
      '6 + 12 = 18。',
      '亦可以直接先計括號：2+4 = 6，3×6 = 18。',
    ],
    methods: [
      { id: 'N1-adv-005-m1', label: '方法一：先計括號', steps: ['2 + 4 = 6', '3×6 = 18'] },
      { id: 'N1-adv-005-m2', label: '方法二：分開乘再加', steps: ['3×2 = 6', '3×4 = 12', '6 + 12 = 18'] },
    ],
    commonMistake: '只乘咗括號入面第一個數，漏咗第二個。',
    source: { book: BOOK, lesson: '1', pages: '10-11' },
  },

  /* ── 課題 2：乘法的運算 ────────────────────────────── */
  {
    id: 'N2-bas-001',
    lesson: '2',
    unit: '1',
    topic: 'multiply-by-tens',
    difficulty: 'basic',
    difficultyTags: ['zero-padding'],
    type: 'type-answer',
    question: '16×20 = ?',
    answer: '320',
    generatedAnswer: '320',
    operands: [16, 20],
    operation: 'a*b',
    options: [],
    correctIndex: -1,
    acceptedAnswers: ['320'],
    estimate: { value: 320, operands: [16, 20], note: '16×2 = 32，補一個 0' },
    hint: '乘以整十數，可以先計咩？',
    explanationSteps: [
      '20 係兩個十。',
      '先當佢係 2：16×2 = 32。',
      '因為係 20，尾巴補一個 0：320。',
      '覆核：16×10 = 160，160×2 = 320。',
    ],
    methods: [
      { id: 'N2-bas-001-m1', label: '方法一：補零法', steps: ['16×2 = 32', '補一個 0 → 320'] },
      { id: 'N2-bas-001-m2', label: '方法二：拆成兩個十', steps: ['16×10 = 160', '160×2 = 320'] },
    ],
    commonMistake: '補零補漏（32）或者補多（3200）。',
    source: { book: BOOK, lesson: '2', pages: '12-14' },
  },
  {
    id: 'N2-bas-002',
    lesson: '2',
    unit: '1',
    topic: 'decompose',
    difficulty: 'basic',
    difficultyTags: ['decompose', 'two-methods'],
    type: 'mc',
    question: '4×12 = ?',
    answer: '48',
    generatedAnswer: '48',
    operands: [4, 12],
    operation: 'a*b',
    options: ['40', '48', '52', '480'],
    correctIndex: 1,
    acceptedAnswers: ['48'],
    estimate: { value: 48, operands: [4, 10], note: '4×10 = 40，比 40 多一點' },
    hint: '12 可以拆成邊兩個數？',
    explanationSteps: [
      '12 = 10 + 2。',
      '4×10 = 40，4×2 = 8。',
      '40 + 8 = 48。',
      '另一條路：12 加倍兩次，12 → 24 → 48。',
    ],
    methods: [
      { id: 'N2-bas-002-m1', label: '方法一：拆分十位個位', steps: ['12 = 10 + 2', '4×10 = 40，4×2 = 8', '40 + 8 = 48'] },
      { id: 'N2-bas-002-m2', label: '方法二：加倍法', steps: ['2×12 = 24', '24 + 24 = 48'] },
    ],
    commonMistake: '只乘咗十位 4×10 = 40，忘記加個位嘅 8。',
    source: { book: BOOK, lesson: '2', pages: '15-17' },
  },
  {
    id: 'N2-adv-003',
    lesson: '2',
    unit: '1',
    topic: 'estimate-first',
    difficulty: 'advanced',
    difficultyTags: ['estimate-first', 'zero-padding', 'real-mistake'],
    type: 'mc',
    question: '70×34 = ?',
    answer: '2380',
    generatedAnswer: '2380',
    operands: [70, 34],
    operation: 'a*b',
    options: ['238', '530', '2380', '23800'],
    correctIndex: 2,
    acceptedAnswers: ['2380'],
    estimate: { value: 2100, operands: [70, 30], note: '70×30 已經 2100，答案最少二千幾' },
    hint: '先估一估 70×34 大約幾多。',
    explanationSteps: [
      '先估算：70×30 = 2100，所以答案一定係二千幾。',
      '238 同 530 都係幾百，明顯太少。',
      '23800 明顯太大。',
      '補零法：7×34 = 238，因為係 70，尾巴補一個 0 → 2380。',
      '覆核：70×34 = 70×30 + 70×4 = 2100 + 280 = 2380。',
    ],
    methods: [
      { id: 'N2-adv-003-m1', label: '方法一：補零法', steps: ['7×34 = 238', '補一個 0 → 2380'] },
      { id: 'N2-adv-003-m2', label: '方法二：展開法', steps: ['70×30 = 2100', '70×4 = 280', '2100 + 280 = 2380'] },
    ],
    commonMistake: '補零時漏咗或多咗一個 0，計出嚟嘅量級同估算差好遠。',
    source: { book: BOOK, lesson: '2', pages: '18-21' },
  },
  {
    id: 'N2-adv-004',
    lesson: '2',
    unit: '1',
    topic: 'two-digit-multiplication',
    difficulty: 'advanced',
    difficultyTags: ['carry', 'decompose', 'real-mistake'],
    type: 'type-answer',
    question: '17×46 = ?',
    answer: '782',
    generatedAnswer: '782',
    operands: [17, 46],
    operation: 'a*b',
    options: [],
    correctIndex: -1,
    acceptedAnswers: ['782'],
    estimate: { value: 850, operands: [17, 50], note: '17×50 = 850，所以答案係八百幾' },
    hint: '先估 17×46 大約幾多。',
    explanationSteps: [
      '估算：17×50 = 850，答案應該係八百幾。',
      '拆位：17×46 = 17×40 + 17×6。',
      '17×40 = 680。',
      '17×6 = 102（個位 2，十位進 10）。',
      '680 + 102 = 782。',
    ],
    methods: [
      { id: 'N2-adv-004-m1', label: '方法一：直式（十位加個位）', steps: ['17×6 = 102', '17×40 = 680', '102 + 680 = 782'] },
      { id: 'N2-adv-004-m2', label: '方法二：拆成 50 減 4', steps: ['17×50 = 850', '17×4 = 68', '850 − 68 = 782'] },
    ],
    commonMistake: '直式進位忘記加，或者兩步加埋時加錯。',
    source: { book: BOOK, lesson: '2', pages: '22-24' },
  },
  {
    id: 'N2-chl-005',
    lesson: '2',
    unit: '1',
    topic: 'order',
    difficulty: 'challenge',
    difficultyTags: ['multi-step', 'order', 'combine'],
    type: 'mc',
    question: '4×9×25 = ?',
    answer: '900',
    generatedAnswer: '900',
    operands: [4, 9, 25],
    operation: 'a*b*c',
    options: ['36', '225', '900', '600'],
    correctIndex: 2,
    acceptedAnswers: ['900'],
    estimate: { value: 900, operands: [100, 9], note: '4×25 = 100，100×9 = 900' },
    hint: '邊兩個數相乘會變整十？',
    explanationSteps: [
      '三個數連乘，次序可以自己揀（乘法交換性質）。',
      '先揀最易嘅組合：4×25 = 100。',
      '100×9 = 900。',
      '如果順序做：4×9 = 36，36×25 比較難計。',
    ],
    methods: [
      { id: 'N2-chl-005-m1', label: '方法一：順序做', steps: ['4×9 = 36', '36×25 = 900'] },
      { id: 'N2-chl-005-m2', label: '方法二：先夾整十', steps: ['4×25 = 100', '100×9 = 900'] },
    ],
    commonMistake: '只乘了其中兩個數，或者次序揀得唔順手。',
    source: { book: BOOK, lesson: '2', pages: '18-21' },
  },
]

export function getQuestionsByLesson(lessonId) {
  const key = String(lessonId)
  return QUESTIONS.filter((q) => q.lesson === key)
}

export function getQuestionById(id) {
  return QUESTIONS.find((q) => q.id === id) || null
}
