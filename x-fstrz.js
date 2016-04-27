var optimizedCodes = ["o"];
var inProgressCodes = ["w"];
var errorCodes = ["e", "t", "vf", "!id", "!conf", "b", "ed", "cbo"];
var cachedCodes = ["c", "clc", "sc"];

var codeMapping = {
  "p" : "request/response proxified",
  "o" : "optimized",
  "!o": "not optimized",
  "w": "optimization in progress",
  "Z": "non optimizable page (will never be optimized, 404, 301, 302, POST, etc.).",
  "ab": "excluded because of A/B testing",
  "stc": "https status code of the origin different than 200",
  "zc": "empty content",
  "ecc": "excluded by customer configuration",
  "tecc": "tag excluded by the configuration",
  "m": "method (HEAD, PROPFIND, OPTIONS, PUT, DELETE, etc.)",
  "ed": "engine disabled",
  "h": "non HTML content (for example, JSON sent with a tex/html content type)",
  "c": "cached",
  "sc": "page is cached via SmartCache (Cache + Ajax)",
  "dc": "optimized, dynamic cache (internal engine behavior)",
  "!c": "not cached",
  "v": "virtual object (concatenation result or outlining)",
  "e": "error, optimization failed, the page is not optimized",
  "vf": "reconstituted virtual object",
  "t": "timeout, the optimization has taken too much time, the page is not optimized",
  "ccb": "Cache CallBack, object is served from the cache by proxy (this is the case where an object doesn’t have a cookie for A/B test",
  "clc": "page is cached via Cookie Less Cache",
  "cbo": "Circuit Breaker Open, the object is not optimized because of temporary unavailability of one of the engine component",
  "of": "Overflow, show that overflow system is in place. Following flags clarify the results.",
  "!id": "No id",
  "!conf": "no configuration found",
  "!en": "overflow not enabled",
  "wen": "overflow was enabled",
  "en": "overflow enabled",
  "dis": "disallow, user was send back to the waiting page",
  "pp": "partial page",
  "ed": "engine disabled",
  "b": "blocked, IP address is blocked",
  "uc": "User Canceled, request was cancelled by the user"
}
