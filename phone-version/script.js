// Phone card: wallpaper, glass and gestures.
//
// One WebGL canvas draws everything behind the page text. The wallpaper goes
// into a texture, then each icon is drawn as its own small pane that bends and
// tints that texture, so the light trails really pass through the glass.

(function () {
  "use strict";

  // Sent here by the main page, so keep the one address in the bar.
  if (location.search === "?card") history.replaceState(null, "", "../");

  const DATA = window.PHONE_DATA;
  const $ = (id) => document.getElementById(id);
  const stage = $("stage");
  const pager = $("pager");
  const canvas = $("gl");

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Build the pages ---------- */

  const lenses = [];

  function makeApp(item) {
    const el = document.createElement(item.url ? "a" : "button");
    el.className = "app";
    if (item.url) {
      el.href = item.url;
      el.target = "_blank";
      el.rel = "noopener";
      el.draggable = false;
    } else {
      el.type = "button";
      el.addEventListener("click", () => openItem(item, el));
    }
    const tile = document.createElement("span");
    tile.className = "tile";
    const label = document.createElement("span");
    label.className = "label";
    // Let long handles wrap at word boundaries instead of mid-word.
    label.textContent = (item.wrap || item.label).replace(/[a-z](?=[A-Z])|\.(?=[a-z])/g, (m) => m + "\u200b");
    el.setAttribute("aria-label", item.label);
    el.append(tile, label);
    return { el, tile, art: item.art, press: 0, pressTarget: 0, base: null };
  }

  function buildPages() {
    DATA.pages.forEach((page) => {
      const section = document.createElement("section");
      section.className = "page";
      const title = document.createElement("h2");
      title.textContent = page.title;
      const grid = document.createElement("div");
      grid.className = "grid";

      page.items.forEach((item) => {
        const lens = makeApp(item);
        grid.append(lens.el);
        lenses.push(lens);
      });

      section.append(title, grid);
      pager.append(section);
    });
  }

  /* ---------- Pager and gestures ---------- */

  let page = 0;
  let pagerX = 0;
  let pagerTarget = 0;
  let pageWidth = 1;
  // Unfolded, two pages sit side by side and a swipe moves both, like a foldable's home screen.
  let perView = 1;
  const stops = () => Math.ceil(DATA.pages.length / perView);
  let drag = null;
  let suppressClick = false;
  const pages = () => pager.children;

  function setPage(i) {
    page = Math.floor(Math.max(0, Math.min(DATA.pages.length - 1, i)) / perView) * perView;
    const stop = page / perView;
    pagerTarget = -stop * pageWidth;
    [...pages()].forEach((el, n) => { el.inert = Math.floor(n / perView) !== stop; });
    const dots = $("dots");
    if (dots.children.length !== stops()) dots.innerHTML = "<i></i>".repeat(stops());
    [...dots.children].forEach((el, n) => el.classList.toggle("on", n === stop));
  }

  function lensFor(target) {
    const app = target.closest && target.closest(".app");
    return app ? lenses.find((l) => l.el === app) : null;
  }

  function onDown(e) {
    if (e.button || sheet.el || drag) return;
    const lens = lensFor(e.target);
    if (lens) lens.pressTarget = 1;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, t: e.timeStamp, v: 0, mode: "tap", lens, startX: pagerX };
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (drag.mode === "tap" && Math.hypot(dx, dy) > 9) {
      drag.mode = Math.abs(dx) > Math.abs(dy) ? "swipe" : "cancel";
      if (drag.lens) drag.lens.pressTarget = 0;
      suppressClick = true;
    }
    if (drag.mode === "swipe") {
      let x = drag.startX + dx;
      const min = -(stops() - 1) * pageWidth;
      if (x > 0) x *= .35;
      else if (x < min) x = min + (x - min) * .35;
      pagerX = pagerTarget = x;
      const dt = Math.max(1, e.timeStamp - drag.t);
      drag.v = (e.clientX - drag.x) / dt;
      drag.x = e.clientX;
      drag.t = e.timeStamp;
    }
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.lens) d.lens.pressTarget = 0;
    if (d.mode === "swipe") {
      const dx = e.clientX - d.x0;
      let next = page;
      if (dx < -pageWidth * .2 || d.v < -.4) next = page + perView;
      else if (dx > pageWidth * .2 || d.v > .4) next = page - perView;
      setPage(next);
    } else if (d.mode === "tap" && e.type === "pointerup" && !d.lens && !e.target.closest("button, a")) {
      emitFromTap(e.clientX, e.clientY);
    }
  }

  function onCancel(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.lens) drag.lens.pressTarget = 0;
    drag = null;
    setPage(page);
  }

  /* ---------- Sheets (folder and notes) ---------- */

  const sheet = { el: null, t: 0, target: 0, rect: null, opener: null };
  const folderEl = $("folder");
  // Everything in px from the top of the screen; base positions sit inside the panel.
  const folder = { top: 0, tip: 0, notchX: 0, height: 1, y: 0, v: 0, max: 0, lenses: [], drag: null };

  function openItem(item, opener) {
    if (suppressClick) return;
    if (item.action === "folder") {
      document.querySelectorAll(".app.opened").forEach((el) => el.classList.remove("opened"));
      opener.classList.add("opened");
      fillFolder(DATA.folders[item.folder]);
      openSheet(folderEl, opener);
      layoutFolder();
    } else if (item.action === "notes") {
      openSheet($("notes-sheet"), opener);
    }
  }

  function fillFolder(data) {
    $("folder-title").textContent = data.title;
    $("folder-note").textContent = data.note;
    const grid = $("folder-grid");
    grid.textContent = "";
    folder.lenses = [];
    folder.y = folder.v = 0;
    data.groups.forEach((group) => group.items.forEach((item) => {
      const lens = makeApp(item);
      if (!gl) lens.tile.style.backgroundImage = `url("${DATA.artUri(lens.art)}")`;
      grid.append(lens.el);
      folder.lenses.push(lens);
    }));
  }

  // The panel opens just under the row, with its notch reaching up to the icon.
  function layoutFolder() {
    const b = lenses.find((l) => l.el === sheet.opener).base;
    folder.tip = b.y + b.hh + 5;
    folder.top = Math.round(b.y + b.hh + 25);
    folder.notchX = b.x + pagerTarget;
    const content = $("folder-content");
    content.style.transform = "none";
    // Only as tall as its icons, always leaving a strip of wallpaper below, as iOS did.
    const room = Math.max(180, cssH - folder.top - ($("dock").offsetHeight - 36));
    folder.height = Math.min(room, content.offsetHeight);
    folderEl.style.top = `${folder.top}px`;
    folderEl.style.height = `${folder.height}px`;
    folder.max = Math.max(0, content.offsetHeight - folder.height);
    folder.y = Math.min(folder.y, folder.max);
    folder.lenses.forEach((l) => {
      const r = l.tile.getBoundingClientRect();
      l.base = { x: r.left + r.width / 2, y: r.top + r.height / 2 - folder.top, hw: r.width / 2, hh: r.height / 2 };
    });
  }

  const lensIn = (target) => {
    const app = target.closest && target.closest(".app");
    return app ? folder.lenses.find((l) => l.el === app) : null;
  };

  function onFolderDown(e) {
    if (e.button || folder.drag) return;
    const lens = lensIn(e.target);
    if (lens) lens.pressTarget = 1;
    folder.v = 0;
    folder.drag = { id: e.pointerId, y0: e.clientY, y: e.clientY, t: e.timeStamp, start: folder.y, moved: false, lens };
  }

  function onFolderMove(e) {
    const d = folder.drag;
    if (!d || e.pointerId !== d.id) return;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.abs(dy) > 9) {
      d.moved = true;
      if (d.lens) d.lens.pressTarget = 0;
      suppressClick = true;
    }
    if (!d.moved) return;
    let y = d.start - dy;
    if (y < 0) y *= .35;
    else if (y > folder.max) y = folder.max + (y - folder.max) * .35;
    folder.y = y;
    folder.v = -(e.clientY - d.y) / Math.max(1, e.timeStamp - d.t) * 1000;
    d.y = e.clientY;
    d.t = e.timeStamp;
  }

  function onFolderUp(e) {
    const d = folder.drag;
    if (!d || e.pointerId !== d.id) return;
    if (d.lens) d.lens.pressTarget = 0;
    // Holding still before letting go shouldn't fling the list.
    if (e.type !== "pointerup" || e.timeStamp - d.t > 80) folder.v = 0;
    folder.drag = null;
  }

  function scrollFolder(dt) {
    if (!folder.drag) {
      folder.y += folder.v * dt;
      folder.v *= Math.exp(-dt * 2.6);
      const held = Math.max(0, Math.min(folder.max, folder.y));
      if (held !== folder.y) {
        folder.v = 0;
        folder.y += (held - folder.y) * (1 - Math.exp(-dt * 14));
        if (Math.abs(held - folder.y) < .25) folder.y = held;
      }
    }
    $("folder-content").style.transform = `translate3d(0,${(-folder.y).toFixed(2)}px,0)`;
    folder.lenses.forEach((l) => { l.press += (l.pressTarget - l.press) * (1 - Math.exp(-dt * (l.pressTarget ? 26 : 12))); });
  }

  function measureSheet() {
    if (!sheet.el) return;
    const transform = sheet.el.style.transform;
    sheet.el.style.transform = "none";
    sheet.rect = sheet.el.getBoundingClientRect();
    sheet.el.style.transform = transform;
  }

  function openSheet(el, opener) {
    sheet.el = el;
    sheet.opener = opener;
    sheet.target = 1;
    el.style.display = "flex";
    measureSheet();
    $("scrim").style.display = "block";
    pager.inert = true;
    el.tabIndex = -1;
    el.focus({ preventScroll: true });
  }

  function closeSheet() {
    if (!sheet.el) return;
    sheet.target = 0;
    $("scrim").style.display = "none";
    pager.inert = false;
    if (sheet.opener) sheet.opener.focus({ preventScroll: true });
  }

  /* ---------- Layout ---------- */

  let cssW = 1, cssH = 1, scale = 1, W = 1, H = 1;
  let quality = 1;

  function measure() {
    cssW = innerWidth;
    cssH = innerHeight;
    scale = Math.min(devicePixelRatio || 1, 2) * quality;
    W = Math.max(1, Math.round(cssW * scale));
    H = Math.max(1, Math.round(cssH * scale));
    pageWidth = stage.clientWidth;
    perView = pageWidth >= 600 ? 2 : 1;
    stage.classList.toggle("spread", perView === 2);
    setPage(page);
    pagerX = pagerTarget;
    pager.style.transform = `translate3d(${pagerX}px,0,0)`;
    // The dock rides down with an open folder; measure where it rests.
    $("dock").style.transform = "none";
    lenses.forEach((l) => {
      const r = l.tile.getBoundingClientRect();
      l.base = { x: r.left + r.width / 2 - pagerX, y: r.top + r.height / 2, hw: r.width / 2, hh: r.height / 2 };
    });
    const c = $("capsule").getBoundingClientRect();
    capsule = { x: c.left + c.width / 2, y: c.top + c.height / 2, hw: c.width / 2, hh: c.height / 2 };
    shelf = document.querySelector(".shelf").getBoundingClientRect();
    measureSheet();
    if (sheet.el === folderEl) layoutFolder();
  }

  let capsule = null;
  let shelf = null;

  /* ---------- WebGL ---------- */

  let gl = null;
  let P = null;
  let targets = null;
  let atlas = null;
  let atlasReady = false;
  const atlasCells = {};
  const CELL = 256, ATLAS = 2048;

  const VS_FULL = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main(){ vUv=aPos*.5+.5; gl_Position=vec4(aPos,0.,1.); }`;

  // The beveled wallpaper tile: four facets per cell, lit from the top.
  const FS_GRID = `
    precision highp float;
    uniform float uCell;
    uniform vec2 uRes;
    void main(){
      vec2 c=gl_FragCoord.xy/uCell;
      vec2 f=fract(c);
      float a=f.x-f.y, b=f.x+f.y-1.;
      float l=(a<0.&&b>0.)?.245:(a>0.&&b>0.)?.135:(a>0.&&b<0.)?.07:.18;
      vec2 g=min(f,1.-f);
      l*=mix(.4,1.,smoothstep(0.,.1,min(g.x,g.y)));
      vec2 v=gl_FragCoord.xy/uRes-.5;
      l*=1.-dot(v,v)*.5;
      gl_FragColor=vec4(vec3(l),1.);
    }`;

  // The iOS 5 dock shelf, drawn into the wallpaper so the glass above bends it.
  const FS_SHELF = `
    precision highp float;
    uniform vec4 uBox;
    void main(){
      vec2 q=gl_FragCoord.xy;
      float u=(q.x-uBox.x)/(uBox.z-uBox.x);
      float v=(uBox.y-q.y)/(uBox.y-uBox.w);
      float plane=clamp(v/.68,0.,1.);
      float inset=mix(.07,0.,plane);
      float px=1./(uBox.z-uBox.x);
      float side=smoothstep(inset-px,inset+px,u)*smoothstep(inset-px,inset+px,1.-u);
      float top=smoothstep(-.012,.012,v);
      float a,l;
      if(v<.68){
        float sheen=step(.56+.34*(1.-plane),u)*.09*(1.-(u-.56)/.44);
        a=mix(.36,.17,plane)+sheen+smoothstep(.04,0.,v)*.3;
        l=1.;
      } else if(v<.71){
        a=.42; l=1.;
      } else {
        a=mix(.16,.5,(v-.71)/.29); l=mix(.8,0.,clamp((v-.71)/.12,0.,1.));
      }
      a*=side*top;
      gl_FragColor=vec4(vec3(l*.86,l*.89,l*.95)*a,a);
    }`;

  // An open folder: wallpaper above, linen in the gap with its notch pointing at
  // the icon, and the rest of the wallpaper pushed down below. Trails still glow
  // faintly through the weave.
  const FS_SPLIT = `
    precision highp float;
    uniform sampler2D uTex, uBlur;
    uniform vec2 uRes;
    uniform vec4 uCut;
    uniform float uPx;
    float hash(float n){ return fract(sin(n*12.9898)*43758.5453); }
    void main(){
      vec2 q=gl_FragCoord.xy;
      float top=uCut.x, bot=uCut.y;
      if(q.y<bot){
        vec3 c=texture2D(uTex,(q+vec2(0.,top-bot))/uRes).rgb;
        c+=vec3(.2)*smoothstep(uPx*1.5,0.,bot-q.y);
        gl_FragColor=vec4(c,1.);
        return;
      }
      float edge=top+max(0.,uCut.w-abs(q.x-uCut.z));
      float depth=edge-q.y;
      vec3 wall=texture2D(uTex,q/uRes).rgb;
      if(depth<-1.){ gl_FragColor=vec4(wall,1.); return; }

      vec2 t=floor(q/(uPx*1.5));
      float thread=mod(t.x+t.y,2.)<.5?hash(t.y):hash(t.x+91.);
      float fleck=hash(t.x*.37+t.y*7.13);
      vec3 cloth=vec3(.165,.18,.21)+(thread-.5)*.085+(fleck-.5)*.035;
      cloth*=1.-.5*exp(-max(depth,0.)/(uPx*7.));
      cloth*=1.-.5*exp(-(q.y-bot)/(uPx*6.));
      vec3 glow=texture2D(uBlur,q/uRes).rgb;
      cloth+=(glow-min(glow.r,min(glow.g,glow.b)))*.34;
      gl_FragColor=vec4(mix(wall,cloth,clamp(depth+.5,0.,1.)),1.);
    }`;

  const FS_COPY = `
    precision mediump float;
    uniform sampler2D uTex;
    uniform float uGain;
    varying vec2 vUv;
    void main(){ gl_FragColor=vec4(texture2D(uTex,vUv).rgb*uGain,1.); }`;

  const FS_DOWN = `
    precision mediump float;
    uniform sampler2D uTex;
    uniform vec2 uTexel;
    varying vec2 vUv;
    void main(){
      vec3 c=texture2D(uTex,vUv+uTexel*vec2(-1.,-1.)).rgb+texture2D(uTex,vUv+uTexel*vec2(1.,-1.)).rgb
            +texture2D(uTex,vUv+uTexel*vec2(-1.,1.)).rgb+texture2D(uTex,vUv+uTexel*vec2(1.,1.)).rgb;
      gl_FragColor=vec4(c*.25,1.);
    }`;

  const VS_PULSE = `
    attribute vec2 aPos;
    attribute vec2 aInfo;
    attribute vec3 aColor;
    attribute vec2 aUv;
    uniform vec2 uRes;
    varying vec2 vInfo;
    varying vec3 vColor;
    varying vec2 vLocal;
    void main(){
      vInfo=aInfo; vColor=aColor; vLocal=aUv;
      gl_Position=vec4(aPos/uRes*2.-1.,0.,1.);
    }`;

  // Trails tint the bevel rather than covering it, as in the real wallpaper.
  const FS_PULSE = `
    precision highp float;
    uniform sampler2D uGrid;
    uniform vec2 uRes;
    varying vec2 vInfo;
    varying vec3 vColor;
    varying vec2 vLocal;
    void main(){
      float g=texture2D(uGrid,gl_FragCoord.xy/uRes).r;
      vec3 c;
      if(vInfo.y<.5){ c=vColor*pow(vInfo.x,1.4)*(.2+g*2.5); }
      else if(vInfo.y<1.5){ c=vColor*(.82+g*.8); }
      else { float d=dot(vLocal,vLocal); c=vColor*exp(-d*5.)*max(0.,1.-d)*.62*vInfo.x; }
      gl_FragColor=vec4(c,1.);
    }`;

  const VS_GLASS = `
    attribute vec2 aPos;
    uniform vec2 uRes;
    uniform vec4 uRect;
    uniform float uPad;
    varying vec2 vP;
    void main(){
      vP=uRect.xy+aPos*(uRect.zw+uPad);
      gl_Position=vec4(vP/uRes*2.-1.,0.,1.);
    }`;

  // The glass itself. uRect is center and half size in device pixels, y up.
  const FS_GLASS = `
    precision highp float;
    uniform sampler2D uScene, uBlur, uArt;
    uniform vec2 uRes;
    uniform vec4 uRect, uAtlas, uTint;
    uniform float uRadius, uPx, uHasArt, uAlpha, uGloss, uFrost, uPress;
    varying vec2 vP;

    float sd(vec2 p){
      vec2 q=abs(p)-uRect.zw+uRadius;
      return length(max(q,0.))+min(max(q.x,q.y),0.)-uRadius;
    }
    vec4 art(vec2 uv){
      vec4 c=texture2D(uArt,uAtlas.xy+uv*uAtlas.zw);
      return vec4(c.rgb/max(c.a,.004),c.a);
    }
    float height(vec2 uv){
      vec4 c=art(uv);
      return c.a*.72+dot(c.rgb,vec3(.3,.59,.11))*c.a*.28;
    }
    void main(){
      vec2 p=vP-uRect.xy;
      float d=sd(p);

      float shadow=smoothstep(uPx*9.,-uPx*3.,sd(p+vec2(0.,uPx*3.)))*.5;
      float mask=smoothstep(.8,-.8,d);
      if(mask<=.001){ gl_FragColor=vec4(0.,0.,0.,shadow*uAlpha); return; }

      vec2 e=vec2(1.,0.);
      vec2 n=normalize(vec2(sd(p+e.xy)-sd(p-e.xy),sd(p+e.yx)-sd(p-e.yx))+1e-5);
      float bevel=uPx*7.;
      float inner=clamp(-d/bevel,0.,1.);
      float slope=(1.-inner)*(1.-inner);

      // uv with y down, to match the artwork
      vec2 uv=vec2(.5+p.x/(2.*uRect.z),.5-p.y/(2.*uRect.w));

      vec4 paint=vec4(uTint.rgb,uTint.a);
      vec2 raised=vec2(0.);
      if(uHasArt>.5){
        paint=art(uv);
        float s=.006;
        raised=vec2(height(uv+vec2(s,0.))-height(uv-vec2(s,0.)),
                    height(uv-vec2(0.,s))-height(uv+vec2(0.,s)));
      }

      // Bend the wallpaper: strong at the rim, gentle lens across the middle.
      vec2 off=-n*slope*uPx*15.-p*.09-raised*uPx*22.;
      vec2 s=(vP+off)/uRes;
      vec2 ca=n*slope*uPx*2.6/uRes;
      vec3 sharp=vec3(texture2D(uScene,s+ca).r,texture2D(uScene,s).g,texture2D(uScene,s-ca).b);
      vec3 soft=texture2D(uBlur,s).rgb;
      vec3 back=mix(sharp,soft,uFrost)*.62+max(soft-.15,0.)*1.1;

      // Light picks up the color of the glass it passes through...
      vec3 stained=mix(vec3(1.),paint.rgb*1.5,paint.a);
      vec3 col=back*stained*.8;
      // ...and the pane holds some of its own color so it reads on a dark wall.
      float lift=.86+.1*uv.y;
      col+=paint.rgb*paint.a*lift;

      // Clear glass catches a little of the room.
      col+=vec3(.03,.035,.05)*(1.-paint.a);

      vec3 fn=normalize(vec3(raised*7.,1.));
      float sp=pow(max(dot(fn,normalize(vec3(-.42,.62,.66))),0.),28.);
      col+=vec3(1.)*sp*.5*step(.0001,dot(raised,raised));

      // iOS 5 gloss, the curved highlight across the top half.
      float arc=.405+.09*(1.-pow(2.*uv.x-1.,2.));
      float gloss=smoothstep(.006,-.006,uv.y-arc);
      col+=vec3(1.)*gloss*mix(.17,.05,uv.y/arc)*uGloss;

      vec2 L=normalize(vec2(-.5,.86));
      float lit=dot(n,L);
      // Light gathers inside the far edge, as it does in real glass.
      col+=mix(paint.rgb,vec3(1.),.35)*slope*max(-lit,0.)*.3;
      col+=vec3(1.)*slope*max(lit,0.)*.14;
      float rim=smoothstep(uPx*1.25,0.,-d);
      col+=vec3(1.)*rim*(.1+.55*max(lit,0.)+.16*max(-lit,0.));

      col*=1.+uPress*.22;

      float a=mask+shadow*(1.-mask);
      gl_FragColor=vec4(col*mask,a)*uAlpha;
    }`;

  function compile(vs, fs, uniforms) {
    const prog = gl.createProgram();
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(([type, src]) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(prog, sh);
    });
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    const out = { prog, u: {}, a: {} };
    uniforms.forEach((n) => { out.u[n] = gl.getUniformLocation(prog, n); });
    ["aPos", "aInfo", "aColor", "aUv"].forEach((n) => { out.a[n] = gl.getAttribLocation(prog, n); });
    return out;
  }

  function makeTarget(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }

  function freeTarget(t) {
    if (!t) return;
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fb);
  }

  let quadBuf = null;
  let pulseBuf = null;
  let cellPx = 16;

  function initGl() {
    gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "default" });
    if (!gl) throw new Error("no webgl");
    P = {
      grid: compile(VS_FULL, FS_GRID, ["uCell", "uRes"]),
      copy: compile(VS_FULL, FS_COPY, ["uTex", "uGain"]),
      shelf: compile(VS_FULL, FS_SHELF, ["uBox"]),
      split: compile(VS_FULL, FS_SPLIT, ["uTex", "uBlur", "uRes", "uCut", "uPx"]),
      down: compile(VS_FULL, FS_DOWN, ["uTex", "uTexel"]),
      pulse: compile(VS_PULSE, FS_PULSE, ["uRes", "uGrid"]),
      glass: compile(VS_GLASS, FS_GLASS, ["uScene", "uBlur", "uArt", "uRes", "uRect", "uAtlas", "uTint", "uRadius", "uPx", "uHasArt", "uAlpha", "uGloss", "uFrost", "uPress", "uPad"])
    };
    quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    pulseBuf = gl.createBuffer();
    atlas = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }

  function sizeTargets() {
    canvas.width = W;
    canvas.height = H;
    if (targets) Object.values(targets).forEach(freeTarget);
    targets = {
      grid: makeTarget(W, H),
      scene: makeTarget(W, H),
      split: makeTarget(W, H),
      quarter: makeTarget(Math.max(1, W >> 2), Math.max(1, H >> 2)),
      eighth: makeTarget(Math.max(1, W >> 3), Math.max(1, H >> 3))
    };
    cellPx = Math.max(4, Math.round(8 * scale));
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets.grid.fb);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND);
    gl.useProgram(P.grid.prog);
    gl.uniform1f(P.grid.u.uCell, cellPx);
    gl.uniform2f(P.grid.u.uRes, W, H);
    drawQuad(P.grid);
  }

  function drawQuad(p) {
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(p.a.aPos);
    gl.vertexAttribPointer(p.a.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function bindTex(unit, tex, loc) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  }

  function buildAtlas() {
    const names = DATA.artNames;
    const perRow = ATLAS / CELL;
    const cv = document.createElement("canvas");
    cv.width = cv.height = ATLAS;
    const ctx = cv.getContext("2d");
    const jobs = names.map((name, i) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const x = (i % perRow) * CELL, y = Math.floor(i / perRow) * CELL;
        ctx.drawImage(img, x, y, CELL, CELL);
        atlasCells[name] = [(x + 1) / ATLAS, (y + 1) / ATLAS, (CELL - 2) / ATLAS, (CELL - 2) / ATLAS];
        resolve();
      };
      img.onerror = resolve;
      img.src = DATA.artUri(name);
    }));
    return Promise.all(jobs).then(() => {
      if (!gl || gl.isContextLost()) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, atlas);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      atlasReady = true;
    });
  }

  /* ---------- Light trails ---------- */

  const COLORS = [[0, .47, 1], [1, .07, .03], [0, .82, .07], [1, .86, 0]];
  const pulsesMax = 64;
  const pulses = [];
  const flashes = [];
  const FLOATS = 9;
  const pulseData = new Float32Array(pulsesMax * 3 * 6 * FLOATS + 8 * 6 * FLOATS);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function addPulse(i, j, dx, dy, color) {
    if (pulses.length >= pulsesMax) return;
    pulses.push({ i, j, dx, dy, color, go: 0, speed: 24 + Math.random() * 12, len: 26 + Math.random() * 18 });
  }

  function spawnAmbient() {
    const cols = Math.ceil(W / cellPx), rows = Math.ceil(H / cellPx);
    const side = Math.floor(Math.random() * 4);
    const color = pick(COLORS);
    if (side === 0) addPulse(-1, Math.floor(Math.random() * rows), 1, 0, color);
    if (side === 1) addPulse(cols, Math.floor(Math.random() * rows), -1, 0, color);
    if (side === 2) addPulse(Math.floor(Math.random() * cols), -1, 0, 1, color);
    if (side === 3) addPulse(Math.floor(Math.random() * cols), rows, 0, -1, color);
  }

  // Tapping empty space fires one trail in each direction, like the original.
  function emitFromTap(x, y) {
    const i = Math.floor(x * scale / cellPx);
    const j = Math.floor((H - y * scale) / cellPx);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => addPulse(i, j, dx, dy, pick(COLORS)));
    const color = pick(COLORS);
    flashes.push({ i, j, color, life: 1 });
    if (flashes.length > 6) flashes.shift();
    boostUntil = performance.now() + 1500;
  }

  let spawnClock = 0;

  function updatePulses(dt) {
    const target = reducedMotion ? 3 : 9;
    spawnClock -= dt;
    const live = pulses.filter((p) => p.ambient !== false).length;
    if (spawnClock <= 0 && live < target) {
      spawnAmbient();
      spawnClock = .25 + Math.random() * .7;
    }
    const cols = Math.ceil(W / cellPx), rows = Math.ceil(H / cellPx);
    for (let n = pulses.length - 1; n >= 0; n--) {
      const p = pulses[n];
      p.go += p.speed * dt * (reducedMotion ? .4 : 1);
      const hi = p.i + p.dx * Math.floor(p.go);
      const hj = p.j + p.dy * Math.floor(p.go);
      const tailI = hi - p.dx * p.len, tailJ = hj - p.dy * p.len;
      const out = (a, max) => a < -2 || a > max + 2;
      if ((p.dx && out(tailI, cols) && Math.sign(tailI - cols / 2) === p.dx) ||
          (p.dy && out(tailJ, rows) && Math.sign(tailJ - rows / 2) === p.dy)) pulses.splice(n, 1);
    }
    for (let n = flashes.length - 1; n >= 0; n--) {
      flashes[n].life -= dt * 2.2;
      if (flashes[n].life <= 0) flashes.splice(n, 1);
    }
  }

  function buildPulseVerts() {
    let o = 0;
    const v = (x, y, s, kind, c, u, w) => {
      pulseData[o++] = x; pulseData[o++] = y; pulseData[o++] = s; pulseData[o++] = kind;
      pulseData[o++] = c[0]; pulseData[o++] = c[1]; pulseData[o++] = c[2];
      pulseData[o++] = u; pulseData[o++] = w;
    };
    const quad = (x0, y0, x1, y1, s00, s10, s01, s11, kind, c) => {
      v(x0, y0, s00, kind, c, -1, -1); v(x1, y0, s10, kind, c, 1, -1); v(x0, y1, s01, kind, c, -1, 1);
      v(x1, y0, s10, kind, c, 1, -1); v(x1, y1, s11, kind, c, 1, 1); v(x0, y1, s01, kind, c, -1, 1);
    };
    const glow = (i, j, c, power, r) => {
      const x = (i + .5) * cellPx, y = (j + .5) * cellPx, R = r * cellPx;
      quad(x - R, y - R, x + R, y + R, power, power, power, power, 2, c);
    };
    pulses.forEach((p) => {
      const steps = Math.floor(p.go);
      const hi = p.i + p.dx * steps, hj = p.j + p.dy * steps;
      const len = Math.min(steps, Math.floor(p.len));
      if (len > 0) {
        const ti = hi - p.dx * len, tj = hj - p.dy * len;
        const x0 = Math.min(hi, ti) * cellPx, x1 = (Math.max(hi, ti) + 1) * cellPx;
        const y0 = Math.min(hj, tj) * cellPx, y1 = (Math.max(hj, tj) + 1) * cellPx;
        if (p.dx > 0) quad(x0, y0, x1, y1, 0, 1, 0, 1, 0, p.color);
        else if (p.dx < 0) quad(x0, y0, x1, y1, 1, 0, 1, 0, 0, p.color);
        else if (p.dy > 0) quad(x0, y0, x1, y1, 0, 0, 1, 1, 0, p.color);
        else quad(x0, y0, x1, y1, 1, 1, 0, 0, 0, p.color);
      }
      quad(hi * cellPx, hj * cellPx, (hi + 1) * cellPx, (hj + 1) * cellPx, 1, 1, 1, 1, 1, p.color);
      glow(hi, hj, p.color, 1, 3.4);
    });
    flashes.forEach((f) => glow(f.i, f.j, f.color, f.life, 8));
    return o / FLOATS;
  }

  /* ---------- Frame ---------- */

  let last = 0;
  let boostUntil = 0;
  let frameSum = 0;
  let frameCount = 0;
  let running = false;

  function update(dt) {
    if (!drag) pagerX += (pagerTarget - pagerX) * (1 - Math.exp(-dt * 15));
    if (Math.abs(pagerTarget - pagerX) < .25) pagerX = pagerTarget;
    pager.style.transform = `translate3d(${pagerX}px,0,0)`;

    lenses.forEach((l) => { l.press += (l.pressTarget - l.press) * (1 - Math.exp(-dt * (l.pressTarget ? 26 : 12))); });

    if (sheet.el) {
      const closingFolder = sheet.el === folderEl;
      sheet.t += (sheet.target - sheet.t) * (1 - Math.exp(-dt * 16));
      if (sheet.target === 0 && sheet.t < .01) {
        sheet.el.style.display = "none";
        if (closingFolder) document.querySelectorAll(".app.opened").forEach((el) => el.classList.remove("opened"));
        else sheet.el.style.opacity = "0";
        sheet.el = null;
        sheet.t = 0;
      } else if (closingFolder) {
        scrollFolder(dt);
        folderEl.style.clipPath = `inset(0 0 ${(folder.height * (1 - sheet.t)).toFixed(1)}px 0)`;
      } else {
        sheet.el.style.opacity = sheet.t.toFixed(3);
        sheet.el.style.transform = `scale(${(.9 + .1 * sheet.t).toFixed(4)})`;
      }
    }
    const isFolder = sheet.el === folderEl;
    // Whatever sits below the split rides down as the folder opens.
    const pushed = isFolder ? `translate3d(0,${(folder.height * sheet.t).toFixed(1)}px,0)` : "none";
    $("dock").style.transform = pushed;
    $("dots").style.transform = pushed;
    pager.style.opacity = (1 - sheet.t * (isFolder ? .75 : 1)).toFixed(3);
    if (gl) updatePulses(dt);
  }

  // The real versions of these had little or no curved shine of their own.
  const QUIET_GLOSS = { youtube: 0, notes: 0, folderAlts: 0, folderDomains: 0, instagram: .3, gplus: 0 };
  const artGloss = (name) => (name in QUIET_GLOSS ? QUIET_GLOSS[name] : 1);

  function drawLens(g, x, y, hw, hh, radius, opts) {
    const u = P.glass.u;
    gl.uniform4f(u.uRect, x * scale, H - y * scale, hw * scale, hh * scale);
    gl.uniform1f(u.uRadius, radius * scale);
    gl.uniform1f(u.uHasArt, opts.cell ? 1 : 0);
    if (opts.cell) gl.uniform4f(u.uAtlas, opts.cell[0], opts.cell[1], opts.cell[2], opts.cell[3]);
    const t = opts.tint || [1, 1, 1, 0];
    gl.uniform4f(u.uTint, t[0], t[1], t[2], t[3]);
    gl.uniform1f(u.uAlpha, opts.alpha);
    gl.uniform1f(u.uGloss, opts.gloss);
    gl.uniform1f(u.uFrost, opts.frost);
    gl.uniform1f(u.uPress, opts.press || 0);
    drawQuad(P.glass);
  }

  function render() {
    // Wallpaper
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets.scene.fb);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND);
    gl.useProgram(P.copy.prog);
    bindTex(0, targets.grid.tex, P.copy.u.uTex);
    gl.uniform1f(P.copy.u.uGain, 1);
    drawQuad(P.copy);

    const count = buildPulseVerts();
    if (count) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      const p = P.pulse;
      gl.useProgram(p.prog);
      gl.uniform2f(p.u.uRes, W, H);
      bindTex(0, targets.grid.tex, p.u.uGrid);
      gl.bindBuffer(gl.ARRAY_BUFFER, pulseBuf);
      gl.bufferData(gl.ARRAY_BUFFER, pulseData.subarray(0, count * FLOATS), gl.DYNAMIC_DRAW);
      const stride = FLOATS * 4;
      const attr = (loc, size, offset) => {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4);
      };
      attr(p.a.aPos, 2, 0); attr(p.a.aInfo, 2, 2); attr(p.a.aColor, 3, 4); attr(p.a.aUv, 2, 7);
      gl.drawArrays(gl.TRIANGLES, 0, count);
      [p.a.aInfo, p.a.aColor, p.a.aUv].forEach((loc) => gl.disableVertexAttribArray(loc));
      gl.disable(gl.BLEND);
    }

    if (shelf) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(P.shelf.prog);
      gl.uniform4f(P.shelf.u.uBox, shelf.left * scale, H - shelf.top * scale, shelf.right * scale, H - shelf.bottom * scale);
      drawQuad(P.shelf);
      gl.disable(gl.BLEND);
    }

    // Soft copy of the wallpaper, for frosted glass and glow
    const step = (src, dst) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.useProgram(P.down.prog);
      bindTex(0, src.tex, P.down.u.uTex);
      gl.uniform2f(P.down.u.uTexel, 1 / src.w, 1 / src.h);
      drawQuad(P.down);
    };
    step(targets.scene, targets.quarter);
    step(targets.quarter, targets.eighth);

    const isFolder = sheet.el === folderEl;
    const openPx = isFolder ? Math.round(folder.height * sheet.t * scale) : 0;
    const panelTop = H - Math.round(folder.top * scale);
    let wall = targets.scene;
    if (openPx > 0) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets.split.fb);
      gl.viewport(0, 0, W, H);
      gl.useProgram(P.split.prog);
      bindTex(0, targets.scene.tex, P.split.u.uTex);
      bindTex(1, targets.eighth.tex, P.split.u.uBlur);
      gl.uniform2f(P.split.u.uRes, W, H);
      gl.uniform1f(P.split.u.uPx, scale);
      gl.uniform4f(P.split.u.uCut, panelTop, panelTop - openPx, folder.notchX * scale, (folder.top - folder.tip) * scale * Math.min(1, sheet.t * 1.5));
      drawQuad(P.split);
      wall = targets.split;
    }

    // To the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(P.copy.prog);
    bindTex(0, wall.tex, P.copy.u.uTex);
    gl.uniform1f(P.copy.u.uGain, isFolder ? 1 : 1 - sheet.t * .55);
    drawQuad(P.copy);

    // Glass
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P.glass.prog);
    const u = P.glass.u;
    bindTex(0, wall.tex, u.uScene);
    bindTex(1, targets.eighth.tex, u.uBlur);
    bindTex(2, atlas, u.uArt);
    gl.uniform2f(u.uRes, W, H);
    gl.uniform1f(u.uPx, scale);
    gl.uniform1f(u.uPad, 12 * scale);

    const iconAlpha = 1 - sheet.t * (isFolder ? .75 : .9);
    if (atlasReady && iconAlpha > .01) {
      lenses.forEach((l) => {
        const b = l.base;
        if (!b) return;
        const x = b.x + pagerX;
        if (x + b.hw + 14 < 0 || x - b.hw - 14 > cssW) return;
        const shrink = 1 - l.press * .07;
        const cell = atlasCells[l.art];
        if (!cell) return;
        drawLens(u, x, b.y, b.hw * shrink, b.hh * shrink, b.hw * shrink * .46, { cell, alpha: isFolder && l.el === sheet.opener ? 1 : iconAlpha, gloss: artGloss(l.art), frost: .55, press: l.press });
      });
    }

    if (capsule) {
      const pushed = openPx / scale;
      if (capsule.y + pushed - capsule.hh - 14 < cssH) {
        drawLens(u, capsule.x, capsule.y + pushed, capsule.hw, capsule.hh, capsule.hh, { tint: [.2, .28, .48, .52], alpha: 1, gloss: .6, frost: .45 });
      }
    }

    if (atlasReady && openPx > 0) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(0, panelTop - openPx, W, openPx);
      folder.lenses.forEach((l) => {
        const b = l.base;
        const y = b && b.y - folder.y;
        const cell = atlasCells[l.art];
        if (!b || !cell || y + b.hh + 14 < 0 || y - b.hh - 14 > folder.height) return;
        const shrink = 1 - l.press * .07;
        drawLens(u, b.x, folder.top + y, b.hw * shrink, b.hh * shrink, b.hw * shrink * .46, { cell, alpha: 1, gloss: artGloss(l.art), frost: .55, press: l.press });
      });
      gl.disable(gl.SCISSOR_TEST);
    }

    if (sheet.el && !isFolder && sheet.rect) {
      const r = sheet.rect, k = .9 + .1 * sheet.t;
      drawLens(u, r.left + r.width / 2, r.top + r.height / 2, r.width / 2 * k, r.height / 2 * k, 26 * k, {
        tint: [.98, .9, .5, .55],
        alpha: sheet.t,
        gloss: 0,
        frost: .85
      });
    }
    gl.disable(gl.BLEND);
  }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const busy = drag || now < boostUntil || sheet.el || pagerX !== pagerTarget || lenses.some((l) => l.press > .01);
    // The wallpaper idles at 30fps to save battery; touching it goes full speed.
    if (!busy && now - last < 31) return;
    const elapsed = now - last;
    const dt = Math.min(.05, elapsed / 1000);
    last = now;
    update(dt);
    if (!gl) return;
    render();
    watchSpeed(elapsed);
  }

  // Drop the resolution on phones that can't keep up.
  function watchSpeed(elapsed) {
    if (elapsed > 200) return;
    frameSum += elapsed;
    frameCount++;
    if (frameCount < 50) return;
    const avg = frameSum / frameCount;
    frameSum = frameCount = 0;
    if (avg > 45 && quality > .5) {
      quality = Math.max(.5, quality - .25);
      measure();
      sizeTargets();
    }
  }

  /* ---------- Start ---------- */

  function useFlatFallback() {
    gl = null;
    document.documentElement.classList.add("no-gl");
    lenses.forEach((l) => { l.tile.style.backgroundImage = `url("${DATA.artUri(l.art)}")`; });
    // Swiping and sheets still animate, just with nothing to draw.
    measure();
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  function start() {
    try {
      initGl();
    } catch (err) {
      console.warn("Phone card: falling back to flat icons.", err);
      useFlatFallback();
      return;
    }
    measure();
    sizeTargets();
    buildAtlas();
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
    for (let i = 0; i < 5; i++) {
      spawnAmbient();
      pulses[pulses.length - 1].go = Math.random() * 40;
    }
  }

  buildPages();

  // A drag that ended without a click mustn't swallow the next tap.
  stage.addEventListener("pointerdown", () => { suppressClick = false; }, true);
  stage.addEventListener("pointerdown", onDown);
  addEventListener("pointermove", onMove);
  addEventListener("pointerup", onUp);
  addEventListener("pointercancel", onCancel);
  stage.addEventListener("click", (e) => {
    if (suppressClick) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick = false;
    }
  }, true);
  stage.addEventListener("dragstart", (e) => e.preventDefault());

  folderEl.addEventListener("pointerdown", onFolderDown);
  addEventListener("pointermove", onFolderMove);
  addEventListener("pointerup", onFolderUp);
  addEventListener("pointercancel", onFolderUp);
  folderEl.addEventListener("wheel", (e) => {
    e.preventDefault();
    folder.v = 0;
    folder.y = Math.max(0, Math.min(folder.max, folder.y + e.deltaY));
  }, { passive: false });
  // Tabbing to an icon brings it into view without the browser scrolling the panel itself.
  folderEl.addEventListener("focusin", (e) => {
    folderEl.scrollTop = 0;
    const lens = lensIn(e.target);
    if (!lens) return;
    const b = lens.base;
    folder.v = 0;
    if (b.y - b.hh - 12 < folder.y) folder.y = Math.max(0, b.y - b.hh - 12);
    else if (b.y + b.hh + 46 > folder.y + folder.height) folder.y = Math.min(folder.max, b.y + b.hh + 46 - folder.height);
  });

  $("scrim").addEventListener("click", closeSheet);
  $("notes-done").addEventListener("click", closeSheet);
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheet();
    if (sheet.el) return;
    if (e.key === "ArrowRight") setPage(page + perView);
    if (e.key === "ArrowLeft") setPage(page - perView);
  });

  addEventListener("resize", () => {
    measure();
    if (gl) sizeTargets();
  });

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    running = false;
    atlasReady = false;
    targets = null;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    try {
      initGl();
      measure();
      sizeTargets();
      buildAtlas();
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    } catch (err) {
      gl = null;
      useFlatFallback();
    }
  });

  setPage(0);
  // Measure after fonts settle, or the labels can shift the tiles.
  start();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
})();
