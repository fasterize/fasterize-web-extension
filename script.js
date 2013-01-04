var d = document.createElement("textarea"),
    e = document.createEvent("Events");
d.style.cssText = "display:none;";
d.value = window.fstrz;
d.addEventListener("action", function() {
    d.parentNode.removeChild(d);
}, true);
document.body.appendChild(d);

// Fire events, to notify the Content script
e.initEvent("RW759_connectExtension", false, true);
d.dispatchEvent(e);
