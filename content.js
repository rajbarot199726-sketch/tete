const STATE_KEY = "liGhc25CollectorState";
const QUERY = "ghc25";

let loopStarted = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeProfileUrl(rawHref) {
  try {
    const url = new URL(rawHref, location.origin);
    if (!url.pathname.includes("/in/")) return null;
    return `${url.origin}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function findSearchInput() {
  return (
    document.querySelector('input[aria-label*="Search" i]') ||
    document.querySelector('input[placeholder*="Search" i]') ||
    document.querySelector('input[role="combobox"]')
  );
}

async function isRunning() {
  const result = await chrome.storage.local.get(STATE_KEY);
  return Boolean(result?.[STATE_KEY]?.running);
}

async function setStatus(status) {
  await chrome.runtime.sendMessage({ type: "collector:set-status", status });
}

async function collectOpenToWorkProfiles() {
  const cards = [...document.querySelectorAll("li.reusable-search__result-container, div.entity-result")];
  const links = [];

  for (const card of cards) {
    const text = card.textContent?.toLowerCase() || "";
    if (!text.includes("open to work") && !text.includes("#opentowork")) continue;

    const anchor = card.querySelector('a[href*="/in/"]');
    if (!anchor?.href) continue;

    const profileUrl = normalizeProfileUrl(anchor.href);
    if (profileUrl) links.push(profileUrl);
  }

  const page = Number(new URL(location.href).searchParams.get("page") || "1");

  await chrome.runtime.sendMessage({
    type: "collector:add-profiles",
    links,
    pageCount: page,
    status: `Collected page ${page} (${links.length} matches)`
  });
}

async function goToPeopleResultsFromAllResults() {
  const seeAllPeople = [...document.querySelectorAll("a,button")].find((el) =>
    /see all people results/i.test(el.textContent || "")
  );

  if (seeAllPeople) {
    seeAllPeople.click();
    await setStatus("Clicked: See all people results");
    return true;
  }

  const peopleTab = [...document.querySelectorAll('a[href*="/search/results/people/"]')][0];
  if (peopleTab) {
    peopleTab.click();
    await setStatus("Opened People tab");
    return true;
  }

  return false;
}

async function navigateFromHomeToSearch() {
  const searchInput = findSearchInput();
  if (!searchInput) return false;

  searchInput.focus();
  searchInput.value = QUERY;
  searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
  searchInput.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));

  const allResultsButton = [...document.querySelectorAll("a,button")].find((el) =>
    /see all results/i.test(el.textContent || "")
  );
  if (allResultsButton) {
    allResultsButton.click();
  }

  await setStatus("Searching for ghc25");
  return true;
}

async function goNextPageIfAny() {
  const nextButton = [...document.querySelectorAll("button,a")].find((el) => {
    const label = `${el.getAttribute("aria-label") || ""} ${el.textContent || ""}`.toLowerCase();
    return label.includes("next");
  });

  if (!nextButton) {
    await setStatus("No next button found. Done.");
    await chrome.runtime.sendMessage({ type: "collector:stop" });
    return false;
  }

  const isDisabled =
    nextButton.getAttribute("aria-disabled") === "true" ||
    nextButton.hasAttribute("disabled") ||
    nextButton.classList.contains("disabled");

  if (isDisabled) {
    await setStatus("Reached final page. Stopped.");
    await chrome.runtime.sendMessage({ type: "collector:stop" });
    return false;
  }

  nextButton.click();
  await setStatus("Moving to next page");
  return true;
}

async function processCurrentPage() {
  if (!(await isRunning())) return;

  const { pathname } = new URL(location.href);

  if (pathname === "/feed/" || pathname === "/" || pathname.startsWith("/home")) {
    await navigateFromHomeToSearch();
    return;
  }

  if (pathname.startsWith("/search/results/all/")) {
    const clicked = await goToPeopleResultsFromAllResults();
    if (!clicked) await setStatus("Could not locate 'See all people results' yet");
    return;
  }

  if (pathname.startsWith("/search/results/people/")) {
    const pageKey = `li-ghc25-processed-${location.pathname}-${location.search}`;
    if (!sessionStorage.getItem(pageKey)) {
      await collectOpenToWorkProfiles();
      sessionStorage.setItem(pageKey, "1");
      await sleep(1200);
      await goNextPageIfAny();
    }
  }
}

async function startLoop() {
  if (loopStarted) return;
  loopStarted = true;

  await setStatus("Collector active");

  while (true) {
    if (!(await isRunning())) {
      loopStarted = false;
      return;
    }

    await processCurrentPage();
    await sleep(1500);
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "collector:start") {
    startLoop();
  }
});

isRunning().then((running) => {
  if (running) startLoop();
});
