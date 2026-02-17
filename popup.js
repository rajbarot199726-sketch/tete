const STATE_KEY = "liGhc25CollectorState";

const statusEl = document.getElementById("status");
const countEl = document.getElementById("count");
const outputEl = document.getElementById("output");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const clearBtn = document.getElementById("clearBtn");

async function getState() {
  return chrome.runtime.sendMessage({ type: "collector:get-state" });
}

function render(state) {
  statusEl.textContent = `Status: ${state.lastStatus || "Idle"}`;
  countEl.textContent = `Saved links: ${state.profileLinks.length}`;
  outputEl.value = state.profileLinks.join("\n");

  startBtn.disabled = state.running;
  stopBtn.disabled = !state.running;
}

async function refresh() {
  const state = await getState();
  render(state);
}

startBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "collector:start" });
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id) {
    chrome.tabs.sendMessage(activeTab.id, { type: "collector:start" }).catch(() => {});
  }
  await refresh();
});

stopBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "collector:stop" });
  await refresh();
});

clearBtn.addEventListener("click", async () => {
  const state = await getState();
  await chrome.storage.local.set({
    [STATE_KEY]: {
      ...state,
      profileLinks: [],
      pageCount: 0,
      lastStatus: "Cleared results",
      updatedAt: new Date().toISOString()
    }
  });
  await refresh();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[STATE_KEY]) return;
  render(changes[STATE_KEY].newValue);
});

refresh();
