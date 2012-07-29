function save_options() {
  var opts = csapuntz.siteblock.read_options();
    
  opts.rules = document.getElementById('rules').value;
  opts.allowed = Number(document.getElementById('allowed').value);
  opts.period = Number(document.getElementById('period').value) * 60;

  csapuntz.siteblock.write_options(opts);

  chrome.extension.getBackgroundPage().onOptionsChanged(opts);

  // Update status to let user know options were saved.
  var status = document.getElementById("status");
  status.innerHTML = "Options Saved.";
  setTimeout(function() {
    status.innerHTML = "";
  }, 750);

}

function restore_options() {
  var opts = csapuntz.siteblock.read_options();

  document.getElementById("rules").value = opts.rules;
  document.getElementById("allowed").value = opts.allowed;
  document.getElementById("period").value = opts.period / 60;
}

function on_load() {
    restore_options();
    document.querySelector('#submit').addEventListener('click', save_options);
}

document.addEventListener('DOMContentLoaded', on_load);
