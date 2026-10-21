// Bounded static export preview with a gateway-like prefix. No rewrite-based routing.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../dist/',import.meta.url));
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.woff2':'font/woff2'};
export function startPreview(port=4175) {
 const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const raw=decodeURIComponent(url.pathname);const relative=raw.startsWith('/preview/')?raw.slice('/preview/'.length):raw.slice(1);const file=resolve(root,relative||'index.html');if(!file.startsWith(root)){res.writeHead(403);res.end();return;}const bytes=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}});
 return new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',()=>ok(server));});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){await startPreview(Number(process.env.W1_PREVIEW_PORT ?? 4175));console.log('Production export preview ready at http://127.0.0.1:4175/preview/');}
