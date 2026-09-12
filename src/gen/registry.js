/* ════════════════════════════════════════════════════════════
   mq4 — registry.js
   題型註冊表。每個 template declare：
     { id, lesson, topic, angle, conceptSource: { pages, concept },
       difficultyLevels: [...], generate(rng, difficulty, level?, seed?) -> Question }
   加新題型就 import + push 落 TEMPLATES。
   ════════════════════════════════════════════════════════════ */

import { makeRng } from './rng.js'
import * as symbolBlank from './templates/symbol-blank.js'
import * as forwardExpand from './templates/forward-expand.js'
import * as reverseCombine from './templates/reverse-combine.js'
import * as reverseSubtract from './templates/reverse-subtract.js'
import * as decompose from './templates/decompose.js'
import * as fastest from './templates/fastest.js'
import * as findError from './templates/find-error.js'
import * as whichProperty from './templates/which-property.js'
import * as wordToExpression from './templates/word-to-expression.js'
import * as reverseUnknown from './templates/reverse-unknown.js'
import * as fillBlank from './templates/fill-blank.js'

function wrap(tpl) {
  return {
    id: tpl.TEMPLATE_ID,
    lesson: tpl.LESSON,
    topic: tpl.TOPIC,
    angle: tpl.ANGLE,
    conceptSource: tpl.CONCEPT_SOURCE,
    difficultyLevels: [tpl.DIFFICULTY],
    generate: tpl.generate,
  }
}

const symbolBlankTemplate = {
  id: symbolBlank.TEMPLATE_ID,
  lesson: symbolBlank.LESSON,
  topic: symbolBlank.TOPIC,
  angle: symbolBlank.ANGLE,
  conceptSource: symbolBlank.CONCEPT_SOURCE,
  difficultyLevels: ['basic', 'advanced', 'challenge'],
  generate: symbolBlank.generate,
}

export const TEMPLATES = [
  symbolBlankTemplate,
  wrap(forwardExpand),
  wrap(reverseCombine),
  wrap(reverseSubtract),
  wrap(decompose),
  wrap(fastest),
  wrap(findError),
  wrap(whichProperty),
  wrap(wordToExpression),
  wrap(reverseUnknown),
  wrap(fillBlank),
]

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || null
}

/**
 * 便捷入口：由 seed 生成一條題目。
 * @param {number} seed
 * @param {{difficulty?: string|null, level?: number|null, template?: string|null}} opts
 * @returns Question
 */
export function generateQuestion(seed, { difficulty = null, level = null, template = null } = {}) {
  const tpl = template ? getTemplate(template) : TEMPLATES[0]
  if (!tpl) throw new Error(`registry: 搵唔到 template「${template}」`)
  const rng = makeRng(seed)
  return tpl.generate(rng, difficulty, level, seed)
}

export default { TEMPLATES, getTemplate, generateQuestion }
