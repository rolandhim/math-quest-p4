/* ════════════════════════════════════════════════════════════
   mq4 — registry.js
   題型註冊表。每個 template declare：
     { id, lesson, topic, angle, conceptSource: { pages, concept },
       difficultyLevels: [...], generate(rng, difficulty, level?, seed?) -> Question }
   加新題型就 import + push 落 TEMPLATES。
   ════════════════════════════════════════════════════════════ */

import { makeRng } from './rng.js'
import * as symbolBlank from './templates/symbol-blank.js'

const symbolBlankTemplate = {
  id: symbolBlank.TEMPLATE_ID,
  lesson: symbolBlank.LESSON,
  topic: symbolBlank.TOPIC,
  angle: symbolBlank.ANGLE,
  conceptSource: symbolBlank.CONCEPT_SOURCE,
  difficultyLevels: ['basic', 'advanced', 'challenge'],
  generate: symbolBlank.generate,
}

export const TEMPLATES = [symbolBlankTemplate]

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || null
}

/**
 * 便捷入口：由 seed 生成一條題目。
 * @param {number} seed
 * @param {{difficulty?: string|null, level?: number|null}} opts
 * @returns Question
 */
export function generateQuestion(seed, { difficulty = null, level = null } = {}) {
  const rng = makeRng(seed)
  return symbolBlankTemplate.generate(rng, difficulty, level, seed)
}

export default { TEMPLATES, getTemplate, generateQuestion }
