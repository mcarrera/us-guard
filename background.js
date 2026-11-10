// US Guard — background service worker
// Fail-closed: default state is BLOCKED. Unlock only with confirmed US IP.

const BLOCK_RULE_ID = 1;
const ALARM_NAME = "us-ip-recheck";
const CHECK_INTERVAL_MINUTES = 1;

// Geolocation endpoints, tried in order. All allow-listed in rules.json.
const GEO_ENDPOINTS = [
  { url: "https://ipwho.is/", pick: (j) => j.country_code },
  { url: "https://ipapi.co/json/", pick: (j) => j.country_code },
  { url: "https://ipinfo.io/json", pick: (j) => j.country }
];

async function fetchCountry() {
  for (const ep of GEO_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(ep.url, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const data = await res.json();
      const code = ep.pick(data);
      if (typeof code === "string" && code.length === 2) {
        return code.toUpperCase();
      }
    } catch (e) {
      // endpoint failed — try the next one
    }
  }
  return null; // all endpoints failed -> stay locked
}

async function hasBlockRule() {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  return rules.some((r) => r.id === BLOCK_RULE_ID);
}

async function setBlocked(blocked) {
  const currentlyBlocked = await hasBlockRule();
  if (blocked && !currentlyBlocked) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [
        {
          id: BLOCK_RULE_ID,
          priority: 1,
          action: { type: "block" },
          condition: { resourceTypes: ["main_frame"] }
        }
      ]
    });
  } else if (!blocked && currentlyBlocked) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [BLOCK_RULE_ID]
    });
  }

  // Badge: green "US" when open, red "X" when locked
  try {
    await chrome.action.setBadgeBackgroundColor({
      color: blocked ? "#c0392b" : "#1f8a4c"
    });
    await chrome.action.setBadgeText({ text: blocked ? "X" : "US" });
  } catch (e) {
    // badge API unavailable — ignore
  }
}

async function check() {
  const country = await fetchCountry();
  if (country === "US") {
    await setBlocked(false);
  } else {
    // Not US, or check failed entirely -> fail closed
    await setBlocked(true);
  }
}

async function init() {
  // Lock first, before anything else. This guarantees no window of opportunity
  // at startup, even if the network check takes a moment.
  await setBlocked(true);

  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: CHECK_INTERVAL_MINUTES
  });

  await check();
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    check();
  }
});

// --- Fallback injector: put spoof.js into the MAIN world of every page ---
// --- Fallback injector: put spoof.js into the MAIN world of every page ---
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "loading" &&
    tab.url &&
    (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
  ) {
    chrome.scripting.executeScript({
      target: { tabId: tabId, allFrames: true },
      injectImmediately: true,
      world: "MAIN",
      files: ["spoof.js"]
    }).catch((e) => console.error("USG inject failed:", e.message));
  }
});

init();
