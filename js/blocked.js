// Copyright 2012 Constantine Sapuntzakis
//

function handleLoad() {
    const url = new URLSearchParams(window.location.search).get('url');
    if (url) {
        const u = /** @type {HTMLAnchorElement | null} */ (document.getElementById("url"));
        if (u) {
            u.href = url;
            u.appendChild(document.createTextNode(url));
        }
    }
}

document.addEventListener('DOMContentLoaded', handleLoad);

