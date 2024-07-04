import csapuntz from "./siteblock.js";

async function save_options() {
  const items = await chrome.storage.local.get(null);
  console.log(items);

  var opts = csapuntz.siteblock.read_options(items);

  opts.rules = document.getElementById('rules').value;
  opts.allowed = Number(document.getElementById('allowed').value);
  opts.period = Number(document.getElementById('period').value) * 60;

  await chrome.storage.local.set({
    "settings": JSON.stringify(opts)
  });

  // Update status to let user know options were saved.
  var status = document.getElementById("status");
  status.innerHTML = "Options Saved.";
  setTimeout(function () {
    status.innerHTML = "";
  }, 750);

}

function restore_options(items) {
  var opts = csapuntz.siteblock.read_options(items);

  document.getElementById("rules").value = opts.rules;
  document.getElementById("allowed").value = opts.allowed;
  document.getElementById("period").value = opts.period / 60;
}

async function on_load() {
  const items = await chrome.storage.local.get(null);
  restore_options(items);

  document.querySelector('#submit').addEventListener('click', save_options);
}

document.addEventListener('DOMContentLoaded', on_load);
