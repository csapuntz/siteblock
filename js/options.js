import csapuntz from "./siteblock.js";

async function save_options() {
  const items = await chrome.storage.local.get(null);
  console.log(items);

  const opts = csapuntz.siteblock.read_options(items);

  opts.rules = /** @type {HTMLInputElement} */ (document.getElementById('rules')).value;
  opts.allowed = Number(/** @type {HTMLInputElement} */ (document.getElementById('allowed')).value);
  opts.period = Number(/** @type {HTMLInputElement} */ (document.getElementById('period')).value) * 60;

  await chrome.storage.local.set({
    "settings": JSON.stringify(opts)
  });

  // Update status to let user know options were saved.
  const status = /** @type {HTMLElement} */ (document.getElementById("status"));
  status.innerHTML = "Options Saved.";
  setTimeout(() => {
    status.innerHTML = "";
  }, 750);

}

/** @param {{ [key: string]: unknown }} items */
function restore_options(items) {
  const opts = csapuntz.siteblock.read_options(items);

  /** @type {HTMLInputElement} */ (document.getElementById("rules")).value = opts.rules;
  /** @type {HTMLInputElement} */ (document.getElementById("allowed")).value = String(opts.allowed);
  /** @type {HTMLInputElement} */ (document.getElementById("period")).value = String(opts.period / 60);
}

async function on_load() {
  const items = await chrome.storage.local.get(null);
  restore_options(items);

  /** @type {HTMLElement} */ (document.querySelector('#submit')).addEventListener('click', save_options);
}

document.addEventListener('DOMContentLoaded', on_load);
