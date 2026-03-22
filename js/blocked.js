// Copyright 2012 Constantine Sapuntzakis
//

function onload() {
    const url = new URLSearchParams(window.location.search).get('url');
    if (url) {
        const u = document.getElementById("url");
        u.href = url;
        u.appendChild(document.createTextNode(url));
    }
}

document.addEventListener('DOMContentLoaded', onload);

