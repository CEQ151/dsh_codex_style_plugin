window.__ModuleLoader__.load({
  id: "dsh-codex-chat-layout",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    function apply(ctx) {
      ctx.effect(() => {
        const css = `[data-phase] {
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

/* Sidebar collapsed: keep the conversation lane near its expanded position.
   Default expanded sidebar 280px - collapsed rail 56px = 224px preserved. */
[data-sidebar-collapsed] [data-conversation-scroll] [data-chat-flow] {
  margin-left: 224px;
}

[data-sidebar-collapsed] [data-composer-card] {
  margin-left: calc(16px + 224px);
}

[data-conversation-scroll] [data-chat-flow] > * {
  min-width: 0;
}`;
        const element = document.createElement("style");
        element.dataset.plugin = "dsh-codex-chat-layout";
        element.textContent = css;
        document.head.append(element);
        return () => { element.remove(); };
      }, "dsh-codex-chat-layout: styles");
    }

    module.exports = { apply };
    return module.exports;
  }
});
