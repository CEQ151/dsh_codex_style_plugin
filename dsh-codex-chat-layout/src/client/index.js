export function apply(ctx) {
  ctx.effect(() => {
    const css = `
/* Codex-style left-anchored conversation lane */
[data-phase] {
  --dsh-chat-content-width: 860px;
}

[data-conversation-scroll] [data-chat-flow] {
  margin-left: 0;
  margin-right: auto;
}

[data-composer-card] {
  align-self: flex-start;
  width: min(calc(100% - 16px), var(--dsh-composer-card-max-width));
  margin-left: 16px;
}

[data-conversation-scroll] [data-chat-flow] > * {
  min-width: 0;
}
`
    const element = document.createElement('style')
    element.dataset.plugin = 'dsh-codex-chat-layout'
    element.textContent = css
    document.head.append(element)
    return () => { element.remove() }
  }, 'dsh-codex-chat-layout: styles')
}
