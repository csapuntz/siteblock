// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  getStorageItems,
  apply_opts_to_form,
  restore_options,
  save_options,
  on_use_sync_changed,
  on_load,
} from "./options.js";
import { resolveUseSyncDefault } from "./storage.js";

// Minimal HTML matching the fields options.js reads/writes
const OPTIONS_HTML = `
  <select id="use_sync">
    <option value="local">Local</option>
    <option value="sync">Sync</option>
  </select>
  <textarea id="rules"></textarea>
  <input type="text" id="allowed" />
  <input type="text" id="period" />
  <button id="submit"></button>
  <div id="status"></div>
`;

/** Build a fake chrome.storage namespace backed by a plain object. */
function makeStorage(initial = {}) {
  const data = { ...initial };
  return {
    get: vi.fn((_keys) => Promise.resolve({ ...data })),
    set: vi.fn((items) => {
      Object.assign(data, items);
      return Promise.resolve();
    }),
    _data: data,
  };
}

beforeEach(() => {
  document.body.innerHTML = OPTIONS_HTML;

  vi.stubGlobal("chrome", {
    storage: {
      local: makeStorage(),
      sync: makeStorage(),
    },
  });
});

// ---------------------------------------------------------------------------
describe("getStorageItems", () => {
  it("returns localItems directly when use_sync is falsy", async () => {
    const local = { use_sync: false, settings: '{"rules":"cnn.com"}' };
    const result = await getStorageItems(local);
    expect(result).toBe(local);
  });

  it("fetches from chrome.storage.sync when use_sync is true", async () => {
    const syncData = { settings: '{"rules":"bbc.com"}' };
    await chrome.storage.sync.set(syncData);

    const result = await getStorageItems({ use_sync: true });
    expect(result).toEqual(syncData);
  });
});

// ---------------------------------------------------------------------------
describe("apply_opts_to_form", () => {
  it("populates all three form fields", () => {
    apply_opts_to_form({ rules: "google.com", allowed: 5, period: 120 });

    expect(document.getElementById("rules").value).toBe("google.com");
    expect(document.getElementById("allowed").value).toBe("5");
    // period is stored in seconds; the form shows hours (period / 60)
    expect(document.getElementById("period").value).toBe("2");
  });

  it("converts period=1440 (24 h) to 24 in the field", () => {
    apply_opts_to_form({ rules: "", allowed: 0, period: 1440 });
    expect(document.getElementById("period").value).toBe("24");
  });
});

// ---------------------------------------------------------------------------
describe("restore_options", () => {
  it("sets use_sync selector to 'sync' when use_sync is true", () => {
    restore_options(
      { settings: '{"rules":"","allowed":0,"period":1440}' },
      true,
    );
    expect(document.getElementById("use_sync").value).toBe("sync");
  });

  it("sets use_sync selector to 'local' when use_sync is false", () => {
    restore_options(
      { settings: '{"rules":"","allowed":0,"period":1440}' },
      false,
    );
    expect(document.getElementById("use_sync").value).toBe("local");
  });

  it("populates form from parsed settings", () => {
    restore_options(
      {
        settings: JSON.stringify({
          rules: "nytimes.com",
          allowed: 3,
          period: 60,
        }),
      },
      false,
    );
    expect(document.getElementById("rules").value).toBe("nytimes.com");
    expect(document.getElementById("allowed").value).toBe("3");
    expect(document.getElementById("period").value).toBe("1");
  });
});

// ---------------------------------------------------------------------------
describe("save_options", () => {
  it("writes to chrome.storage.local when selector is 'local'", async () => {
    await chrome.storage.local.set({ use_sync: false });
    document.getElementById("use_sync").value = "local";
    document.getElementById("rules").value = "reddit.com";
    document.getElementById("allowed").value = "2";
    document.getElementById("period").value = "1";

    await save_options();

    const localItems = await chrome.storage.local.get(null);
    const syncItems = await chrome.storage.sync.get(null);
    expect(typeof localItems.settings).toBe("string");
    expect("settings" in syncItems).toBe(false);
  });

  it("writes to chrome.storage.sync when selector is 'sync'", async () => {
    await chrome.storage.local.set({ use_sync: true });
    document.getElementById("use_sync").value = "sync";
    document.getElementById("rules").value = "twitter.com";
    document.getElementById("allowed").value = "5";
    document.getElementById("period").value = "2";

    await save_options();

    const syncItems = await chrome.storage.sync.get(null);
    expect(typeof syncItems.settings).toBe("string");
  });

  it("round-trips period correctly (hours → seconds)", async () => {
    await chrome.storage.local.set({ use_sync: false });
    document.getElementById("use_sync").value = "local";
    document.getElementById("rules").value = "";
    document.getElementById("allowed").value = "0";
    document.getElementById("period").value = "24"; // 24 hours entered

    await save_options();

    const saved = JSON.parse((await chrome.storage.local.get(null)).settings);
    expect(saved.period).toBe(1440); // 24 * 60 = 1440 seconds
  });

  it("shows error in status div when storage throws", async () => {
    await chrome.storage.local.set({ use_sync: false });
    chrome.storage.local.set.mockRejectedValue(new Error("quota exceeded"));
    document.getElementById("use_sync").value = "local";
    document.getElementById("rules").value = "";
    document.getElementById("allowed").value = "0";
    document.getElementById("period").value = "1";

    await save_options();

    expect(document.getElementById("status").textContent).toMatch(
      /quota exceeded/,
    );
  });
});

// ---------------------------------------------------------------------------
describe("on_use_sync_changed", () => {
  it("loads from chrome.storage.sync and updates form when selector is 'sync'", async () => {
    const syncSettings = JSON.stringify({
      rules: "bbc.com",
      allowed: 3,
      period: 120,
    });
    await chrome.storage.sync.set({ settings: syncSettings });

    document.getElementById("use_sync").value = "sync";
    await on_use_sync_changed();

    expect(document.getElementById("rules").value).toBe("bbc.com");
    expect(document.getElementById("allowed").value).toBe("3");
    expect(document.getElementById("period").value).toBe("2"); // 120s / 60
  });

  it("loads from chrome.storage.local and updates form when selector is 'local'", async () => {
    const localSettings = JSON.stringify({
      rules: "cnn.com",
      allowed: 5,
      period: 60,
    });
    await chrome.storage.local.set({ settings: localSettings });

    document.getElementById("use_sync").value = "local";
    await on_use_sync_changed();

    expect(document.getElementById("rules").value).toBe("cnn.com");
    expect(document.getElementById("period").value).toBe("1"); // 60s / 60
  });
});

// ---------------------------------------------------------------------------
describe("on_load", () => {
  it("populates form from local storage on load (use_sync=false)", async () => {
    const settings = JSON.stringify({
      rules: "reddit.com",
      allowed: 2,
      period: 180,
    });
    await chrome.storage.local.set({ use_sync: false, settings });

    await on_load();

    expect(document.getElementById("rules").value).toBe("reddit.com");
    expect(document.getElementById("allowed").value).toBe("2");
    expect(document.getElementById("period").value).toBe("3"); // 180s / 60
    expect(document.getElementById("use_sync").value).toBe("local");
  });

  it("populates form from sync storage on load (use_sync=true)", async () => {
    const settings = JSON.stringify({
      rules: "twitter.com",
      allowed: 1,
      period: 60,
    });
    await chrome.storage.local.set({ use_sync: true });
    await chrome.storage.sync.set({ settings });

    await on_load();

    expect(document.getElementById("rules").value).toBe("twitter.com");
    expect(document.getElementById("use_sync").value).toBe("sync");
  });

  it("attaches save_options to the submit button click", async () => {
    await chrome.storage.local.set({ use_sync: false });

    await on_load();

    document.getElementById("submit").click();
    // Give the async handler a tick to run
    await new Promise((r) => setTimeout(r, 0));

    // save_options writes settings to local storage when use_sync is false
    const localItems = await chrome.storage.local.get(null);
    expect("settings" in localItems).toBe(true);
  });

  it("attaches on_use_sync_changed to the use_sync selector change", async () => {
    const localSettings = JSON.stringify({
      rules: "nytimes.com",
      allowed: 0,
      period: 1440,
    });
    await chrome.storage.local.set({
      use_sync: false,
      settings: localSettings,
    });

    await on_load();

    // Switch selector to 'sync' and fire change — on_use_sync_changed should reload from sync
    const syncSettings = JSON.stringify({
      rules: "wsj.com",
      allowed: 0,
      period: 1440,
    });
    await chrome.storage.sync.set({ settings: syncSettings });
    document.getElementById("use_sync").value = "sync";
    document.getElementById("use_sync").dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));

    expect(document.getElementById("rules").value).toBe("wsj.com");
  });
});

// ---------------------------------------------------------------------------
describe("resolveUseSyncDefault", () => {
  it("returns localItems unchanged when use_sync is already set", async () => {
    const localItems = { use_sync: false, settings: '{"rules":"cnn.com"}' };
    const result = await resolveUseSyncDefault(localItems);
    expect(result).toBe(localItems);
    expect("use_sync" in (await chrome.storage.local.get(null))).toBe(false);
  });

  it("sets use_sync=true for a fresh install (no settings key)", async () => {
    const localItems = {};
    const result = await resolveUseSyncDefault(localItems);
    expect(result.use_sync).toBe(true);
    expect((await chrome.storage.local.get(null)).use_sync).toBe(true);
  });

  it("sets use_sync=false when upgrading from an older version (settings present)", async () => {
    const localItems = { settings: '{"rules":"reddit.com"}' };
    const result = await resolveUseSyncDefault(localItems);
    expect(result.use_sync).toBe(false);
    expect((await chrome.storage.local.get(null)).use_sync).toBe(false);
  });
});
