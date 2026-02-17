const STATE_KEY = "liGhc25CollectorState";

const defaultState = {
  running: false,
  query: "ghc25",
  profileLinks: [],
  pageCount: 0,
  updatedAt: null,
  lastStatus: "Idle"
};

async function getState() {
  const result = await chrome.storage.local.get(STATE_KEY);
  return { ...defaultState, ...(result[STATE_KEY] || {}) };
}

async function setState(nextState) {
  await chrome.storage.local.set({ [STATE_KEY]: nextState });
  await updateBadge(nextState);
}

async function updateBadge(state) {
  const text = state.running ? String(state.profileLinks.length) : "";
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: "#0a66c2" });
}

async function startCollector() {
  const state = await getState();
  const nextState = {
    ...state,
    running: true,
    updatedAt: new Date().toISOString(),
    lastStatus: "Started"
  };
  await setState(nextState);

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id) {
    chrome.tabs.sendMessage(activeTab.id, { type: "collector:start" }).catch(() => {});
  }
}

async function stopCollector(reason = "Stopped by user") {
  const state = await getState();
  const nextState = {
    ...state,
    running: false,
    updatedAt: new Date().toISOString(),
    lastStatus: reason
  };
  await setState(nextState);
}

chrome.runtime.onInstalled.addListener(async () => {
  await setState(defaultState);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "collector:get-state") {
      sendResponse(await getState());
      return;
    }

    if (message?.type === "collector:start") {
      await startCollector();
      sendResponse(await getState());
      return;
    }

    if (message?.type === "collector:stop") {
      await stopCollector();
      sendResponse(await getState());
      return;
    }

    if (message?.type === "collector:add-profiles") {
      const state = await getState();
      const incoming = Array.isArray(message.links) ? message.links : [];
      const deduped = new Set(state.profileLinks);
      for (const link of incoming) deduped.add(link);

      const nextState = {
        ...state,
        profileLinks: [...deduped],
        pageCount: typeof message.pageCount === "number" ? Math.max(state.pageCount, message.pageCount) : state.pageCount,
        updatedAt: new Date().toISOString(),
        lastStatus: message.status || state.lastStatus
      };

      await setState(nextState);
      sendResponse(nextState);
      return;
    }

    if (message?.type === "collector:set-status") {
      const state = await getState();
      const nextState = {
        ...state,
        lastStatus: message.status || state.lastStatus,
        updatedAt: new Date().toISOString()
      };
      await setState(nextState);
      sendResponse(nextState);
      return;
    }
  })();

  return true;
});
