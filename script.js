const GLASS_ENGINE = (() => {
    const forced = new URLSearchParams(location.search).get("glass");
    if (forced === "svg" || forced === "webgl") return forced;

    const supportsBackdrop = window.CSS && CSS.supports("backdrop-filter", "url(#a)");
    if (!supportsBackdrop) return "webgl";

    const brands = navigator.userAgentData && navigator.userAgentData.brands;
    if (brands) return brands.some(b => b.brand === "Chromium") ? "svg" : "webgl";

    const ua = navigator.userAgent;
    const isChromium = /Chrome\/|Chromium\//.test(ua) && !/Firefox\/|FxiOS|CriOS|EdgiOS|iPhone|iPad|iPod/.test(ua);
    return isChromium ? "svg" : "webgl";
})();

document.documentElement.classList.add(GLASS_ENGINE === "svg" ? "lg-svg" : "lg-webgl");

// No right-click menu on the background art; links and windows keep theirs.
document.addEventListener("contextmenu", (e) => {
    if (!e.target.closest(".window")) e.preventDefault();
});

const GLASS = {
    cornerRadius: 8,
    bezel: 22,
    thickness: 40,
    ior: 1.5,
    strength: 1.0,
    dispersion: 0.0,
    blur: 3,
    desaturate: 0.15,
    tint: [0.04, 0.08, 0.14],
    tintAmount: 0.20,

    rimLight: [-0.45, -1.0],
    rimWidth: 1.5,
    rimStrength: 0.45,
    rimBackStrength: 0.15,
    rimGlow: 0.06
};

const WEBGL_GLASS = {
    bevel: 8, tiltPower: 1.5, normalTilt: 0.8, refraction: 0.030, dispersion: 0.10
};

document.addEventListener("DOMContentLoaded", () => {
    const socialWindow = document.getElementById("social-window");
    const aboutWindow = document.getElementById("about-window");
    const titleBar = document.getElementById("titleBar");
    const aboutTitleBar = document.getElementById("aboutTitleBar");

    const helpButton = document.getElementById("helpButton");
    const closeAboutBtn = document.getElementById("closeAbout");

    const glassWindows = [socialWindow, aboutWindow];

    // Window Dragging Logic
    let highestZ = 20;

    // Pop-up Logic
    helpButton.addEventListener("pointerdown", (e) => e.stopPropagation());
    helpButton.addEventListener("click", (e) => {
        e.stopPropagation();
        aboutWindow.style.display = "flex";
        highestZ++;
        aboutWindow.style.zIndex = highestZ;
    });

    closeAboutBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    closeAboutBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        aboutWindow.style.display = "none";
    });

    function makeDraggable(winEl, dragHandle) {
        let isDragging = false;
        let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

        winEl.addEventListener("pointerdown", () => {
            highestZ++;
            winEl.style.zIndex = highestZ;
        });

        dragHandle.addEventListener("pointerdown", (e) => {
            if (e.button !== 0 || e.target.closest(".title-bar-controls")) return;
            e.preventDefault();
            highestZ++;
            winEl.style.zIndex = highestZ;

            if (dragHandle.setPointerCapture) dragHandle.setPointerCapture(e.pointerId);
            const rect = winEl.getBoundingClientRect();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            winEl.style.transform = "none";
            winEl.style.left = `${rect.left}px`;
            winEl.style.top = `${rect.top}px`;

            initialLeft = rect.left;
            initialTop = rect.top;

        });

        function clampToViewport(left, top) {
            const maxLeft = Math.max(0, window.innerWidth - winEl.offsetWidth);
            const maxTop = Math.max(0, window.innerHeight - winEl.offsetHeight);
            return [
                Math.min(Math.max(0, left), maxLeft),
                Math.min(Math.max(0, top), maxTop),
            ];
        }

        document.addEventListener("pointermove", (e) => {
            if (!isDragging) return;
            const [left, top] = clampToViewport(
                initialLeft + (e.clientX - startX),
                initialTop + (e.clientY - startY)
            );
            winEl.style.left = `${left}px`;
            winEl.style.top = `${top}px`;
        });

        function reclamp() {
            if (!winEl.style.left) return;
            const [left, top] = clampToViewport(parseFloat(winEl.style.left), parseFloat(winEl.style.top));
            winEl.style.left = `${left}px`;
            winEl.style.top = `${top}px`;
        }
        window.addEventListener("resize", reclamp);
        if (window.ResizeObserver) new ResizeObserver(reclamp).observe(winEl);

        const endDrag = () => {
            if (!isDragging) return;
            isDragging = false;

        };

        document.addEventListener("pointerup", endDrag);
        document.addEventListener("pointercancel", endDrag);
    }

    makeDraggable(socialWindow, titleBar);
    makeDraggable(aboutWindow, aboutTitleBar);

    if (GLASS_ENGINE === "svg") {
        initSvgGlass(glassWindows);
        return;
    }

    // ---- WebGL / Three.js Setup ----
    const canvas = document.getElementById('webgl-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    // Asking for more pixels than the browser can draw squeezes the whole scene into a corner.
    const gl = renderer.getContext();
    const maxDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
    const fitPixelRatio = (w, h) => Math.min(window.devicePixelRatio, maxDims[0] / w, maxDims[1] / h);

    renderer.setPixelRatio(fitPixelRatio(window.innerWidth, window.innerHeight));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const camera = new THREE.OrthographicCamera(0, window.innerWidth, window.innerHeight, 0, 0.1, 10);
    camera.position.z = 1;
    const scene = new THREE.Scene();

    const glState = { failed: false };
    const textureLoader = new THREE.TextureLoader();
    const uTexRes = new THREE.Vector2(1920, 1080);
    const bgTexture = textureLoader.load('2.jpg', (tex) => {
        uTexRes.set(tex.image.width, tex.image.height);
    }, undefined, () => {
        glState.failed = true;
        document.documentElement.classList.add("lg-nogl");
    });

    const baseUniforms = {
        uTexture: { value: bgTexture },
        uScreenRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uTexRes: { value: uTexRes }
    };

    const bgMaterial = new THREE.ShaderMaterial({
        uniforms: baseUniforms,
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
            varying vec2 vUv; uniform sampler2D uTexture; uniform vec2 uScreenRes; uniform vec2 uTexRes;
            vec2 getCoverUv(vec2 uv, vec2 res, vec2 texRes) {
                vec2 ratio = vec2(min((res.x/res.y)/(texRes.x/texRes.y), 1.0), min((res.y/res.x)/(texRes.y/texRes.x), 1.0));
                return uv * ratio + (1.0 - ratio) * 0.5;
            }
            void main() { gl_FragColor = texture2D(uTexture, getCoverUv(vUv, uScreenRes, uTexRes)); }
        `,
        depthTest: false
    });

    const planeGeom = new THREE.PlaneGeometry(1, 1);
    const bgMesh = new THREE.Mesh(planeGeom, bgMaterial);
    bgMesh.scale.set(window.innerWidth, window.innerHeight, 1);
    bgMesh.position.set(window.innerWidth / 2, window.innerHeight / 2, 0);
    scene.add(bgMesh);

    window.addEventListener("resize", () => {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setPixelRatio(fitPixelRatio(w, h));
        renderer.setSize(w, h);
        camera.right = w; camera.top = h; camera.updateProjectionMatrix();
        baseUniforms.uScreenRes.value.set(w, h);
        bgMesh.scale.set(w, h, 1); bgMesh.position.set(w / 2, h / 2, 0);
    });

    initWebglGlass(glassWindows, { scene, camera, renderer, planeGeom, baseUniforms, glState });
});

function initSvgGlass(windows) {
    const SVG_NS = "http://www.w3.org/2000/svg";

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
    const defs = document.createElementNS(SVG_NS, "defs");
    svg.appendChild(defs);
    document.body.prepend(svg);

    const dmap = buildDisplacementTiles();
    const scale = (dmap.maxDisp * GLASS.strength) / (127 / 255);

    const colorMatrix = (() => {
        const l = [0.299, 0.587, 0.114];
        const s = GLASS.desaturate, t = GLASS.tintAmount;
        const rows = [];
        for (let i = 0; i < 3; i++) {
            const row = [];
            for (let j = 0; j < 3; j++) row.push((1 - t) * ((i === j ? 1 - s : 0) + s * l[j]));
            row.push(0, t * GLASS.tint[i]);
            rows.push(row.map(v => +v.toFixed(5)).join(" "));
        }
        rows.push("0 0 0 1 0");
        return rows.join("  ");
    })();

    windows.forEach(win => {
        const refract = document.createElement("div");
        refract.className = "lg-layer lg-refract";
        const shine = document.createElement("div");
        shine.className = "lg-layer lg-shine";
        win.append(refract, shine);

        let filterEl = null, version = 0, lastKey = "";

        const rebuild = () => {
            const rect = win.getBoundingClientRect();
            const w = Math.round(rect.width * 100) / 100;
            const h = Math.round(rect.height * 100) / 100;
            if (w < dmap.T * 2 + 1 || h < dmap.T * 2 + 1) return;

            const key = `${w}|${h}`;
            if (key === lastKey) return;
            lastKey = key;

            const id = `lg-${win.id}-${++version}`;
            const f = buildFilter(id, w, h);
            defs.appendChild(f);
            refract.style.backdropFilter = `url(#${id})`;
            if (filterEl) filterEl.remove();
            filterEl = f;
        };

        new ResizeObserver(rebuild).observe(win);
        rebuild();

        win.addEventListener("pointermove", (e) => {
            const r = win.getBoundingClientRect();
            shine.style.setProperty("--lg-mx", `${e.clientX - r.left}px`);
            shine.style.setProperty("--lg-my", `${e.clientY - r.top}px`);
        });
        win.addEventListener("pointerenter", () => win.classList.add("lg-hover"));
        win.addEventListener("pointerleave", () => win.classList.remove("lg-hover"));
    });

    function buildFilter(id, w, h) {
        const T = dmap.T, t = dmap.tiles;
        const midW = Math.max(w - 2 * T, 0), midH = Math.max(h - 2 * T, 0);
        const img = (href, x, y, iw, ih, result) =>
            `<feImage href="${href}" x="${x}" y="${y}" width="${iw}" height="${ih}" preserveAspectRatio="none" result="${result}"/>`;
        const nine = (set, p, base) => `
            ${img(set.tl, 0, 0, T, T, p + "tl")}
            ${img(set.tc, T, 0, midW, T, p + "tc")}
            ${img(set.tr, w - T, 0, T, T, p + "tr")}
            ${img(set.ml, 0, T, T, midH, p + "ml")}
            ${img(set.mr, w - T, T, T, midH, p + "mr")}
            ${img(set.bl, 0, h - T, T, T, p + "bl")}
            ${img(set.bc, T, h - T, midW, T, p + "bc")}
            ${img(set.br, w - T, h - T, T, T, p + "br")}
            <feMerge result="${p}map">
                ${base ? `<feMergeNode in="${base}"/>` : ""}
                ${["tl", "tc", "tr", "ml", "mr", "bl", "bc", "br"].map(k => `<feMergeNode in="${p}${k}"/>`).join("")}
            </feMerge>`;
        const only = (ch) => {
            const m = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
            m[ch * 6] = 1;
            return m.join(" ");
        };
        const sR = (scale * (1 - GLASS.dispersion)).toFixed(2);
        const sG = scale.toFixed(2);
        const sB = (scale * (1 + GLASS.dispersion)).toFixed(2);

        const f = document.createElementNS(SVG_NS, "filter");
        f.setAttribute("id", id);
        f.setAttribute("x", "0");
        f.setAttribute("y", "0");
        f.setAttribute("width", "100%");
        f.setAttribute("height", "100%");
        f.setAttribute("color-interpolation-filters", "sRGB");
        f.innerHTML = `
            <feFlood flood-color="rgb(128,128,128)" result="d_base"/>
            ${nine(t, "d_", "d_base")}
            ${nine(dmap.spec, "s_", null)}

            <feGaussianBlur in="SourceGraphic" stdDeviation="${GLASS.blur}" edgeMode="duplicate" result="blurred"/>

            ${GLASS.dispersion > 0 ? `
            <feDisplacementMap in="blurred" in2="d_map" scale="${sR}" xChannelSelector="R" yChannelSelector="G" result="disp_r"/>
            <feDisplacementMap in="blurred" in2="d_map" scale="${sG}" xChannelSelector="R" yChannelSelector="G" result="disp_g"/>
            <feDisplacementMap in="blurred" in2="d_map" scale="${sB}" xChannelSelector="R" yChannelSelector="G" result="disp_b"/>
            <feColorMatrix in="disp_r" type="matrix" values="${only(0)}" result="ch_r"/>
            <feColorMatrix in="disp_g" type="matrix" values="${only(1)}" result="ch_g"/>
            <feColorMatrix in="disp_b" type="matrix" values="${only(2)}" result="ch_b"/>
            <feComposite in="ch_r" in2="ch_g" operator="arithmetic" k2="1" k3="1" result="ch_rg"/>
            <feComposite in="ch_rg" in2="ch_b" operator="arithmetic" k2="1" k3="1" result="refracted"/>
            ` : `
            <feDisplacementMap in="blurred" in2="d_map" scale="${sG}" xChannelSelector="R" yChannelSelector="G" result="refracted"/>
            `}

            <feColorMatrix in="refracted" type="matrix" values="${colorMatrix}" result="tinted"/>

            <feMerge>
                <feMergeNode in="tinted"/>
                <feMergeNode in="s_map"/>
            </feMerge>
        `;
        return f;
    }
}

function buildDisplacementTiles() {
    const r = GLASS.cornerRadius, bezel = GLASS.bezel;
    const lensR = Math.max(r, bezel);
    const T = Math.ceil(lensR) + 2;
    const S = 2 * T + 1;
    const half = S / 2;

    const boxSdf = (px, py, rad) => {
        const qx = Math.abs(px) - half + rad, qy = Math.abs(py) - half + rad;
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
    };

    const surface = (x) => Math.pow(1 - Math.pow(1 - x, 4), 0.25);
    const eta = 1 / GLASS.ior;
    const lensDisp = (x) => {
        if (x >= 1) return 0;
        const y = surface(x);
        const deriv = (surface(Math.min(x + 1e-4, 1)) - y) / 1e-4;
        const mag = Math.hypot(deriv, 1);
        const nx = -deriv / mag, ny = -1 / mag;
        const k = 1 - eta * eta * (1 - ny * ny);
        if (k < 0) return 0;
        const a = eta * ny + Math.sqrt(k);
        return (-a * nx) * ((y * bezel + GLASS.thickness) / (eta - a * ny));
    };
    let maxDisp = 0;
    for (let i = 0; i < 512; i++) maxDisp = Math.max(maxDisp, lensDisp(i / 512));
    maxDisp = maxDisp || 1;

    const smooth = (e0, e1, v) => {
        const t = Math.min(Math.max((v - e0) / (e1 - e0), 0), 1);
        return t * t * (3 - 2 * t);
    };
    const lLen = Math.hypot(GLASS.rimLight[0], GLASS.rimLight[1]) || 1;
    const lx = GLASS.rimLight[0] / lLen, ly = GLASS.rimLight[1] / lLen;

    const data = new Uint8ClampedArray(S * S * 4);
    const spec = new Uint8ClampedArray(S * S * 4);
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const px = x + 0.5 - half, py = y + 0.5 - half;

            let gx = boxSdf(px + 1, py, lensR) - boxSdf(px - 1, py, lensR);
            let gy = boxSdf(px, py + 1, lensR) - boxSdf(px, py - 1, lensR);
            const gl = Math.hypot(gx, gy) || 1;
            gx /= gl; gy /= gl;
            const depth = Math.max(-boxSdf(px, py, lensR), 0);
            const v = lensDisp(depth / bezel) / maxDisp;

            const red = 128 - gx * v * 127;
            const green = 128 - gy * v * 127;

            let shine = 0;
            const d = boxSdf(px, py, r);
            if (d <= 0) {
                const facing = gx * lx + gy * ly;
                const lit = Math.max(facing, 0) * GLASS.rimStrength + Math.max(-facing, 0) * GLASS.rimBackStrength;
                const rim = 1 - smooth(0, GLASS.rimWidth, -d);
                const glow = GLASS.rimGlow * v * (0.4 + 0.6 * Math.max(facing, 0));
                shine = Math.min(rim * lit + glow, 1);
            }

            const i = (y * S + x) * 4;
            data[i] = red; data[i + 1] = green; data[i + 2] = 128; data[i + 3] = 255;
            spec[i] = 255; spec[i + 1] = 255; spec[i + 2] = 255; spec[i + 3] = shine * 255;
        }
    }

    const slice = (x0, y0, w, h, src = data) => {
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        const out = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const si = ((y0 + y) * S + (x0 + x)) * 4, di = (y * w + x) * 4;
                out.data[di] = src[si]; out.data[di + 1] = src[si + 1];
                out.data[di + 2] = src[si + 2]; out.data[di + 3] = src[si + 3];
            }
        }
        ctx.putImageData(out, 0, 0);
        return c.toDataURL("image/png");
    };

    const E = T + 1;
    const nineSlice = (src) => ({
        tl: slice(0, 0, T, T, src), tc: slice(T, 0, 1, T, src), tr: slice(E, 0, T, T, src),
        ml: slice(0, T, T, 1, src), mr: slice(E, T, T, 1, src),
        bl: slice(0, E, T, T, src), bc: slice(T, E, 1, T, src), br: slice(E, E, T, T, src)
    });
    return { T, maxDisp, tiles: nineSlice(data), spec: nineSlice(spec) };
}

function initWebglGlass(windows, { scene, camera, renderer, planeGeom, baseUniforms, glState }) {
    const f = (v) => Number(v).toFixed(5);
    const vertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
    const fragmentShader = `
        uniform sampler2D uTexture; uniform vec2 uScreenRes; uniform vec2 uTexRes;
        uniform vec2 uPlaneBottomLeft; uniform vec2 uPlaneSize; uniform vec2 uMouse;
        uniform float uMouseActive; uniform float uCornerRadius;

        varying vec2 vUv;

        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        float snoise(vec2 v) {
            const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
            vec2 i  = floor(v + dot(v, C.yy) ); vec2 x0 = v - i + dot(i, C.xx);
            vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod289(i);
            vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
            m = m*m; m = m*m;
            vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
            vec3 g; g.x  = a0.x  * x0.x  + h.x  * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }

        float roundBoxSDF(vec2 p, vec2 b, float r) {
            vec2 q = abs(p) - b + vec2(r); return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
        }

        vec2 getCoverUv(vec2 uv, vec2 res, vec2 texRes) {
            vec2 ratio = vec2(min((res.x/res.y)/(texRes.x/texRes.y), 1.0), min((res.y/res.x)/(texRes.y/texRes.x), 1.0));
            return uv * ratio + (1.0 - ratio) * 0.5;
        }

        void main() {
            vec2 px = vUv * uPlaneSize;
            vec2 halfSize = uPlaneSize * 0.5;
            vec2 p = px - halfSize;
            
            float distToEdge = roundBoxSDF(p, halfSize, uCornerRadius);
            if (distToEdge > 0.0) discard;

            float bevelWidth = ${f(WEBGL_GLASS.bevel)}; 
            float inwardDist = -distToEdge; 
            float bevelRatio = clamp(inwardDist / bevelWidth, 0.0, 1.0);
            
            vec2 eps = vec2(1.0, 0.0);
            float d1 = roundBoxSDF(p + eps.xy, halfSize, uCornerRadius);
            float d2 = roundBoxSDF(p - eps.xy, halfSize, uCornerRadius);
            float d3 = roundBoxSDF(p + eps.yx, halfSize, uCornerRadius);
            float d4 = roundBoxSDF(p - eps.yx, halfSize, uCornerRadius);
            vec2 sdfGrad = normalize(vec2(d1 - d2, d3 - d4)); 
            
            float tilt = pow(1.0 - smoothstep(0.0, 1.0, bevelRatio), ${f(WEBGL_GLASS.tiltPower)});
            float noise = snoise(px * 0.03) * 0.015; 
            vec3 normal = normalize(vec3(sdfGrad * tilt * ${f(WEBGL_GLASS.normalTilt)} + noise, 1.0));

            vec2 screenPixel = uPlaneBottomLeft + px;
            vec2 baseScreenUv = screenPixel / uScreenRes;
            
            float refracStrength = ${f(WEBGL_GLASS.refraction)}; 
            vec2 offsetR = normal.xy * (refracStrength * ${f(1 - WEBGL_GLASS.dispersion)});
            vec2 offsetG = normal.xy * (refracStrength * 1.00);
            vec2 offsetB = normal.xy * (refracStrength * ${f(1 + WEBGL_GLASS.dispersion)});

            vec3 color = vec3(0.0); float total = 0.0; float blurSize = 8.0 / uScreenRes.x; 
            
            for(int i = 0; i < 16; i++) {
                float angle = float(i) * 6.28318 / 16.0; vec2 blurOffset = vec2(cos(angle), sin(angle)) * blurSize;
                color.r += texture2D(uTexture, getCoverUv(baseScreenUv - offsetR + blurOffset, uScreenRes, uTexRes)).r;
                color.g += texture2D(uTexture, getCoverUv(baseScreenUv - offsetG + blurOffset, uScreenRes, uTexRes)).g;
                color.b += texture2D(uTexture, getCoverUv(baseScreenUv - offsetB + blurOffset, uScreenRes, uTexRes)).b;
                total += 1.0;
            }
            for(int i = 0; i < 8; i++) {
                float angle = float(i) * 6.28318 / 8.0; vec2 blurOffset = vec2(cos(angle), sin(angle)) * (blurSize * 0.5);
                color.r += texture2D(uTexture, getCoverUv(baseScreenUv - offsetR + blurOffset, uScreenRes, uTexRes)).r;
                color.g += texture2D(uTexture, getCoverUv(baseScreenUv - offsetG + blurOffset, uScreenRes, uTexRes)).g;
                color.b += texture2D(uTexture, getCoverUv(baseScreenUv - offsetB + blurOffset, uScreenRes, uTexRes)).b;
                total += 1.0;
            }
            color.r += texture2D(uTexture, getCoverUv(baseScreenUv - offsetR, uScreenRes, uTexRes)).r;
            color.g += texture2D(uTexture, getCoverUv(baseScreenUv - offsetG, uScreenRes, uTexRes)).g;
            color.b += texture2D(uTexture, getCoverUv(baseScreenUv - offsetB, uScreenRes, uTexRes)).b;
            total += 1.0; color /= total;

            color = mix(color, vec3(dot(color, vec3(0.299, 0.587, 0.114))), ${f(GLASS.desaturate)}); 
            color = mix(color, vec3(${GLASS.tint.map(f).join(", ")}), ${f(GLASS.tintAmount)}); 

            vec3 lightPos = vec3(uMouse, 80.0); 
            vec3 lightDir = normalize(lightPos - vec3(px, 0.0));
            vec3 viewDir = vec3(0.0, 0.0, 1.0);
            
            float spec = pow(max(dot(normal, normalize(lightDir + viewDir)), 0.0), 32.0);
            color += spec * 0.35 * uMouseActive; 
            color += max(dot(normal, lightDir), 0.0) * exp(-length(uMouse - px) * 0.004) * 0.15 * uMouseActive; 
            color += smoothstep(0.3, 1.0, 1.0 - max(dot(normal, viewDir), 0.0)) * 0.30; 

            gl_FragColor = vec4(color, 1.0);
        }
    `;

    const windowsData = windows.map(el => {
        const uniforms = {
            ...baseUniforms,
            uPlaneBottomLeft: { value: new THREE.Vector2() },
            uPlaneSize: { value: new THREE.Vector2() },
            uMouse: { value: new THREE.Vector2() },
            uMouseActive: { value: 0.0 },
            uCornerRadius: { value: GLASS.cornerRadius }
        };
        const mesh = new THREE.Mesh(planeGeom, new THREE.ShaderMaterial({ uniforms, transparent: true, vertexShader, fragmentShader }));
        scene.add(mesh);

        let targetMouseActive = 0.0;
        el.addEventListener("pointermove", (e) => {
            const rect = el.getBoundingClientRect();
            uniforms.uMouse.value.set(e.clientX - rect.left, rect.height - (e.clientY - rect.top));
        });
        el.addEventListener("pointerenter", () => targetMouseActive = 1.0);
        el.addEventListener("pointerleave", () => targetMouseActive = 0.0);

        return { el, mesh, uniforms, getTargetMouse: () => targetMouseActive };
    });

    function animate() {
        if (glState.failed) return;
        windowsData.forEach(data => {
            if (data.el.style.display === "none") {
                data.mesh.visible = false;
                return;
            }
            data.mesh.visible = true;

            const rect = data.el.getBoundingClientRect();
            data.mesh.scale.set(rect.width, rect.height, 1);

            const centerX = rect.left + rect.width / 2;
            const centerY = window.innerHeight - (rect.top + rect.height / 2);

            const zIndexStr = window.getComputedStyle(data.el).zIndex;
            const zIndexVal = zIndexStr !== "auto" ? parseInt(zIndexStr) : 10;
            data.mesh.position.set(centerX, centerY, zIndexVal * 0.001);

            data.uniforms.uPlaneBottomLeft.value.set(rect.left, window.innerHeight - rect.bottom);
            data.uniforms.uPlaneSize.value.set(rect.width, rect.height);
            data.uniforms.uMouseActive.value += (data.getTargetMouse() - data.uniforms.uMouseActive.value) * 0.1;
        });

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    animate();
}
