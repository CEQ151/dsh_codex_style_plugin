import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-session-projection'
import { sourcesProjectionDefinition } from './projection.ts'

export type * from './types.ts'
export { applySourcesEvent, canonicalizeUrl, createSourcesState, sourcesProjectionDefinition } from './projection.ts'

export const name = 'ui-sources'
export const inject = ['sessionProjections']

export function apply(ctx: Context): void {
  ctx.sessionProjections.register(sourcesProjectionDefinition)
}
