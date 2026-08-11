(() => {
  const $ = id => document.getElementById(id);
  const fileInput=$("fileInput"), chooseBtn=$("chooseBtn"), dropZone=$("dropZone"), workspace=$("workspace"), error=$("error");
  const pdfCanvas=$("pdfCanvas"), redactCanvas=$("redactionCanvas"), stage=$("pageStage");
  const ctx=pdfCanvas.getContext("2d"), rctx=redactCanvas.getContext("2d");
  let pdf=null, bytes=null, pageNum=1, pageCount=0, scale=1.55, redactions={}, drawing=false, start=null, current=null;

  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  $("year").textContent=new Date().getFullYear();

  chooseBtn.onclick=()=>fileInput.click();
  fileInput.onchange=()=>fileInput.files[0]&&loadFile(fileInput.files[0]);
  ["dragenter","dragover"].forEach(e=>dropZone.addEventListener(e,ev=>{ev.preventDefault();dropZone.classList.add("drag")}));
  ["dragleave","drop"].forEach(e=>dropZone.addEventListener(e,ev=>{ev.preventDefault();dropZone.classList.remove("drag")}));
  dropZone.addEventListener("drop",e=>{const f=e.dataTransfer.files[0]; if(f) loadFile(f)});

  async function loadFile(file){
    error.textContent="";
    if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){error.textContent="Please choose a PDF file.";return}
    try{
      bytes=new Uint8Array(await file.arrayBuffer());
      pdf=await pdfjsLib.getDocument({data:bytes.slice()}).promise;
      pageCount=pdf.numPages; pageNum=1; redactions={};
      $("fileName").textContent=file.name;
      workspace.classList.remove("hidden"); document.querySelector(".hero").classList.add("hidden");
      await renderPage();
    }catch(e){console.error(e);error.textContent="HideIt couldn't open that PDF."}
  }

  async function renderPage(){
    const page=await pdf.getPage(pageNum);
    const maxW=Math.min(780,window.innerWidth-70);
    const base=page.getViewport({scale:1});
    scale=Math.min(1.8,maxW/base.width);
    const vp=page.getViewport({scale});
    pdfCanvas.width=redactCanvas.width=Math.round(vp.width);
    pdfCanvas.height=redactCanvas.height=Math.round(vp.height);
    stage.style.width=vp.width+"px";stage.style.height=vp.height+"px";
    await page.render({canvasContext:ctx,viewport:vp}).promise;
    drawRedactions(); updateUI();
  }
  function updateUI(){
    $("pageLabel").textContent=`Page ${pageNum} of ${pageCount}`;
    $("mobilePageLabel").textContent=`${pageNum} / ${pageCount}`;
    $("prevBtn").disabled=$("prevMobile").disabled=pageNum<=1;
    $("nextBtn").disabled=$("nextMobile").disabled=pageNum>=pageCount;
    const total=Object.values(redactions).reduce((n,a)=>n+a.length,0);
    $("redactionCount").textContent=`${total} redaction${total===1?"":"s"}`;
    $("undoBtn").disabled=!(redactions[pageNum]?.length);
  }
  function drawRedactions(){
    rctx.clearRect(0,0,redactCanvas.width,redactCanvas.height);
    rctx.fillStyle="#050505";
    (redactions[pageNum]||[]).forEach(x=>rctx.fillRect(x.x,x.y,x.w,x.h));
    if(current)rctx.fillRect(current.x,current.y,current.w,current.h);
  }
  function point(e){
    const rect=redactCanvas.getBoundingClientRect(), sx=redactCanvas.width/rect.width, sy=redactCanvas.height/rect.height;
    const t=e.touches?.[0]||e.changedTouches?.[0]||e;
    return {x:(t.clientX-rect.left)*sx,y:(t.clientY-rect.top)*sy};
  }
  function begin(e){e.preventDefault();drawing=true;start=point(e);current={x:start.x,y:start.y,w:0,h:0}}
  function move(e){if(!drawing)return;e.preventDefault();const p=point(e);current={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(p.x-start.x),h:Math.abs(p.y-start.y)};drawRedactions()}
  function end(e){if(!drawing)return;e.preventDefault();drawing=false;if(current&&current.w>6&&current.h>6){(redactions[pageNum]??=[]).push(current)}current=null;drawRedactions();updateUI()}
  redactCanvas.addEventListener("pointerdown",begin);redactCanvas.addEventListener("pointermove",move);window.addEventListener("pointerup",end);

  async function go(n){if(n<1||n>pageCount)return;pageNum=n;await renderPage()}
  $("prevBtn").onclick=$("prevMobile").onclick=()=>go(pageNum-1);
  $("nextBtn").onclick=$("nextMobile").onclick=()=>go(pageNum+1);
  $("undoBtn").onclick=()=>{redactions[pageNum]?.pop();drawRedactions();updateUI()};
  $("clearPageBtn").onclick=()=>{redactions[pageNum]=[];drawRedactions();updateUI()};
  $("startOverBtn").onclick=()=>location.reload();

  $("exportBtn").onclick=async()=>{
    const total=Object.values(redactions).reduce((n,a)=>n+a.length,0);
    if(!total){alert("Draw at least one redaction first.");return}
    const btn=$("exportBtn"), old=btn.textContent;btn.disabled=true;btn.textContent="Making safe copy…";
    try{
      const out=await PDFLib.PDFDocument.create();
      for(let i=1;i<=pageCount;i++){
        const page=await pdf.getPage(i), base=page.getViewport({scale:1});
        const exportScale=Math.min(2.2,2200/base.width);
        const vp=page.getViewport({scale:exportScale});
        const c=document.createElement("canvas");c.width=Math.round(vp.width);c.height=Math.round(vp.height);
        const cctx=c.getContext("2d");cctx.fillStyle="#fff";cctx.fillRect(0,0,c.width,c.height);
        await page.render({canvasContext:cctx,viewport:vp}).promise;
        cctx.fillStyle="#000";
        const pageR=redactions[i]||[];
        // Stored redactions are in the interactive render coordinate system.
        // Convert via normalized page coordinates so export resolution can differ.
        const interactivePage=await pdf.getPage(i);
        const ivp=interactivePage.getViewport({scale:Math.min(1.8,Math.min(780,window.innerWidth-70)/interactivePage.getViewport({scale:1}).width)});
        pageR.forEach(r=>cctx.fillRect(r.x/ivp.width*c.width,r.y/ivp.height*c.height,r.w/ivp.width*c.width,r.h/ivp.height*c.height));
        const blob=await new Promise(res=>c.toBlob(res,"image/jpeg",.94));
        const jpg=await out.embedJpg(await blob.arrayBuffer());
        const p=out.addPage([base.width,base.height]);p.drawImage(jpg,{x:0,y:0,width:base.width,height:base.height});
      }
      out.setTitle("");out.setAuthor("");out.setSubject("");out.setKeywords([]);out.setCreator("HideIt");out.setProducer("HideIt");
      const saved=await out.save();
      const url=URL.createObjectURL(new Blob([saved],{type:"application/pdf"}));
      const a=document.createElement("a");a.href=url;a.download=`HideIt-${new Date().toISOString().slice(0,10)}.pdf`;a.click();
      setTimeout(()=>URL.revokeObjectURL(url),3000);
      btn.textContent="✓ Safe copy downloaded";setTimeout(()=>btn.textContent=old,2200);
    }catch(e){console.error(e);alert("HideIt couldn't create the redacted copy.");btn.textContent=old}
    finally{btn.disabled=false}
  };
})();