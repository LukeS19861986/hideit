import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

const $=s=>document.querySelector(s);
const input=$("#fileInput"), choose=$("#chooseBtn"), drop=$("#dropZone"), editor=$("#editor");
const canvas=$("#pdfCanvas"), overlay=$("#redactCanvas"), ctx=canvas.getContext("2d"), octx=overlay.getContext("2d");
let bytes=null,pdf=null,page=1,scale=1.45,redactions={},drawing=false,start=null,current=null;

choose.onclick=()=>input.click();
input.onchange=e=>e.target.files[0]&&load(e.target.files[0]);
["dragenter","dragover"].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.add("drag")}));
["dragleave","drop"].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove("drag")}));
drop.addEventListener("drop",e=>{const f=e.dataTransfer.files[0];if(f)load(f)});
$("#closeBtn").onclick=()=>{editor.classList.add("hidden");pdf=null;bytes=null;redactions={};input.value="";window.scrollTo({top:0,behavior:"smooth"})};
$("#prevBtn").onclick=()=>{if(page>1){page--;render()}};
$("#nextBtn").onclick=()=>{if(pdf&&page<pdf.numPages){page++;render()}};
$("#undoBtn").onclick=()=>{const a=redactions[page]||[];a.pop();paint()};
$("#clearBtn").onclick=()=>{redactions[page]=[];paint()};
$("#downloadBtn").onclick=download;

async function load(file){
 if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")) return alert("Please choose a PDF file.");
 bytes=new Uint8Array(await file.arrayBuffer());
 pdf=await pdfjsLib.getDocument({data:bytes.slice()}).promise; page=1; redactions={};
 editor.classList.remove("hidden"); await render(); editor.scrollIntoView({behavior:"smooth"});
}
async function render(){
 const p=await pdf.getPage(page), vp=p.getViewport({scale});
 canvas.width=vp.width;canvas.height=vp.height;overlay.width=vp.width;overlay.height=vp.height;
 await p.render({canvasContext:ctx,viewport:vp}).promise;
 $("#pageLabel").textContent=`Page ${page} of ${pdf.numPages}`;paint();
}
function pos(e){
 const r=overlay.getBoundingClientRect(),t=e.touches?.[0]||e;
 return {x:(t.clientX-r.left)*(overlay.width/r.width),y:(t.clientY-r.top)*(overlay.height/r.height)};
}
function begin(e){e.preventDefault();drawing=true;start=pos(e);current={x:start.x,y:start.y,w:0,h:0}}
function move(e){if(!drawing)return;e.preventDefault();const p=pos(e);current={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(p.x-start.x),h:Math.abs(p.y-start.y)};paint(current)}
function end(e){if(!drawing)return;drawing=false;if(current.w>4&&current.h>4)(redactions[page]??=[]).push(current);current=null;paint()}
overlay.addEventListener("pointerdown",begin);overlay.addEventListener("pointermove",move);window.addEventListener("pointerup",end);
function paint(temp){
 octx.clearRect(0,0,overlay.width,overlay.height);octx.fillStyle="#050806";
 for(const r of redactions[page]||[])octx.fillRect(r.x,r.y,r.w,r.h);
 if(temp)octx.fillRect(temp.x,temp.y,temp.w,temp.h);
}
async function download(){
 if(!bytes)return;
 const {PDFDocument}=PDFLib;
 const out=await PDFDocument.create();
 for(let i=1;i<=pdf.numPages;i++){
   const p=await pdf.getPage(i), vp=p.getViewport({scale:2});
   const c=document.createElement("canvas");c.width=vp.width;c.height=vp.height;
   const cctx=c.getContext("2d");await p.render({canvasContext:cctx,viewport:vp}).promise;
   cctx.fillStyle="#050806";
   const baseVp=p.getViewport({scale});
   const sx=vp.width/baseVp.width,sy=vp.height/baseVp.height;
   for(const r of redactions[i]||[])cctx.fillRect(r.x*sx,r.y*sy,r.w*sx,r.h*sy);
   const jpg=await new Promise(res=>c.toBlob(res,"image/jpeg",0.92));
   const img=await out.embedJpg(await jpg.arrayBuffer());
   const pg=out.addPage([p.view[2]-p.view[0],p.view[3]-p.view[1]]);
   pg.drawImage(img,{x:0,y:0,width:pg.getWidth(),height:pg.getHeight()});
 }
 const data=await out.save(),blob=new Blob([data],{type:"application/pdf"}),url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download="HideIt-redacted.pdf";a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}