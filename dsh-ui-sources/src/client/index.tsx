import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveWorkspacePath } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '../types.ts'
import type { OpenLocalPath, SourcesPanelController, SourcesPanelState } from './controller.ts'
import { EditedFilesCard } from './EditedFilesCard.tsx'
import { fileChangesDefinition, selectFileChanges } from './turn-file-changes.ts'
import { SourcePanelAction, type SourcesPanelInjected } from './SourcePanelAction.tsx'
import { SourcesDetailsPanel, type SourcesDetailsInjected } from './SourcesPanels.tsx'
import { en, NS, zh, type SourcesLocaleKey } from './locales.ts'
import styles from './styles.css'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'ui-sources': SourcesLocaleKey
  }
}

export const inject = ['slots', 'locale', 'workspaces', 'layout', 'conversationEvents']

interface LayoutFace {
  openDetails: () => void
  closeDetails: () => void
}

export function apply(ctx: ClientContext): void {
  const layout = (ctx as ClientContext & { layout: LayoutFace }).layout
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-sources: dictionaries')
  ctx.effect(() => {
    const element = document.createElement('style')
    element.dataset.plugin = 'dsh-ui-sources'
    element.textContent = styles
    document.head.append(element)
    return () => { element.remove() }
  }, 'ui-sources: styles')

  const listeners = new Set<() => void>()
  let state: SourcesPanelState = { cardVisible: true, detailsOpen: false }
  let disposeDetails: (() => void) | undefined
  const openLocalPath: OpenLocalPath =
    (cwd, path) => ctx.workspaces.openPath(resolveWorkspacePath(cwd, path))
  const emit = () => { listeners.forEach(listener => { listener() }) }
  const setState = (patch: Partial<SourcesPanelState>) => {
    state = { ...state, ...patch }
    emit()
  }

  const panel: SourcesPanelController = {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getSnapshot: () => state,
    setCardVisible: (visible) => {
      if (state.cardVisible === visible) return
      setState({ cardVisible: visible })
    },
    toggleCard: () => {
      setState({ cardVisible: !state.cardVisible })
    },
    openDetails: () => {
      if (state.detailsOpen) {
        layout.openDetails()
        return
      }
      disposeDetails = ctx.slots.register({
        name: 'details',
        priority: -1000,
        locale: NS,
        inject: (): SourcesDetailsInjected => ({
          closeSources: () => { panel.closeDetails() },
          openLocalPath,
        }),
      }, SourcesDetailsPanel)
      setState({ detailsOpen: true })
      layout.openDetails()
    },
    closeDetails: () => {
      if (!state.detailsOpen) return
      disposeDetails?.()
      disposeDetails = undefined
      setState({ detailsOpen: false })
      layout.closeDetails()
    },
  }

  ctx.conversationEvents.register(fileChangesDefinition)
  ctx.effect(() => () => { panel.closeDetails() }, 'ui-sources: panel controller')
  ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
    name: 'conversation.chat.turnTail',
    select: selectFileChanges,
    priority: -100,
    locale: NS,
    inject: () => ({}),
  }, EditedFilesCard))
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'ui-sources',
    order: 80,
    locale: NS,
    inject: (): SourcesPanelInjected => ({ openLocalPath, panel }),
  }, SourcePanelAction))
}

export type { SourcesPanelInjected, SourcesPanelProps } from './SourcePanelAction.tsx'
export type { SourcesDetailsInjected, SourcesDetailsProps } from './SourcesPanels.tsx'
export type { SourcesPanelState } from './controller.ts'
