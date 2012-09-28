var s = document.createElement('script');
s.src = chrome.extension.getURL("script.js");
(document.head||document.documentElement).appendChild(s);
s.onload = function() {
    s.parentNode.removeChild(s);
};

// Event listener
document.addEventListener("RW759_connectExtension", function(e) {
    var from = e.target;
    if (from) {
        // Deserialize the string
        var fasterized = from.value === "true";

        chrome.extension.sendRequest({ fasterized: fasterized });

        // Trigger callback, to finish the event, so that the temporary element can be removed
        var o_event = document.createEvent('Events');
        o_event.initEvent('action', true, false);
        from.value = "Example. Test. This is the response";
        from.dispatchEvent(o_event);
    }
}, true);
