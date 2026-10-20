const handleMobileAccordion = (): void => {
  const detailsContact = document.getElementById("contact-details") as HTMLElement | null;
  const detailsEducation = document.getElementById("education-details") as HTMLElement | null;
  if (!detailsContact || !detailsEducation) return;

  if (window.innerWidth <= 1024) {
    detailsContact.setAttribute("open", "true");
    detailsEducation.setAttribute("open", "true");
  }
};

handleMobileAccordion();
window.addEventListener("resize", handleMobileAccordion);

const btn = document.getElementById("menu-toggle") as HTMLElement | null;
const sidebar = document.getElementById("sidebar") as HTMLElement | null;
const container = document.querySelector(".app-container") as HTMLElement | null;

btn?.addEventListener("click", () => {
  sidebar?.classList.toggle("is-open");
  container?.classList.toggle("sidebar-open");
});

const navLinks = document.querySelectorAll(".nav-item") as NodeListOf<HTMLElement>;

const syncActiveNavFromHash = (): void => {
  const currentHash = window.location.hash.replace(/^#/, "");
  if (!currentHash) return;
  navLinks.forEach((link) => {
    const section = link.getAttribute("data-section");
    link.classList.toggle("active", section === currentHash);
  });
};

syncActiveNavFromHash();
window.addEventListener("hashchange", syncActiveNavFromHash);

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
    sidebar?.classList.remove("is-open");
    container?.classList.remove("sidebar-open");
  });
});

// --- Avatar 3D Estático con Único Efecto de Pestañeo Natural ---
const initBlinkingAvatar = (): void => {
  const canvasEl = document.getElementById("sidebar-avatar-canvas") as HTMLCanvasElement | null;
  if (!canvasEl) return;
  const glCtx = canvasEl.getContext("webgl", { premultipliedAlpha: false, antialias: true });
  if (!glCtx) {
    canvasEl.style.display = "none";
    return;
  }
  const canvas: HTMLCanvasElement = canvasEl;
  const gl: WebGLRenderingContext = glCtx;

  const vsSource = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const fsSource = `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_blink;

    float ellipseMask(vec2 uv, vec2 center, vec2 radii, float feather) {
      vec2 d = (uv - center) / radii;
      float dist = length(d);
      return 1.0 - smoothstep(1.0 - feather, 1.0 + feather, dist);
    }

    void main() {
      vec2 uv = v_uv;

      // Coordenadas exactas de ambos ojos en avatar-3d.jpg (sin ningún otro movimiento)
      vec2 eyeL = vec2(0.425, 0.362);
      vec2 eyeR = vec2(0.573, 0.362);
      vec2 eyeRadii = vec2(0.045, 0.028);
      float maskL = ellipseMask(uv, eyeL, eyeRadii, 0.35);
      float maskR = ellipseMask(uv, eyeR, eyeRadii, 0.35);
      float eyeMask = max(maskL, maskR);

      if (eyeMask > 0.001 && u_blink > 0.001) {
        float eyeTopY = 0.333;
        uv.y = mix(uv.y, eyeTopY + (uv.y - eyeTopY) * (1.0 - u_blink * 0.89), eyeMask * u_blink);
      }

      gl_FragColor = texture2D(u_tex, uv);
    }
  `;

  const compileShader = (type: number, source: string): WebGLShader | null => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
  };

  const prog = gl.createProgram();
  const vs = compileShader(gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
  if (!prog || !vs || !fs) return;

  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );
  const aPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uBlink = gl.getUniformLocation(prog, "u_blink");

  let nextBlinkTime = performance.now() + 2400;
  let blinkStartTime = -1;

  const tex = gl.createTexture();
  const img = new Image();
  img.src = "/avatar-3d.jpg";
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    requestAnimationFrame(render);
  };

  function render(now: number): void {
    if (now > nextBlinkTime) {
      blinkStartTime = now;
      const isDoubleBlink = Math.random() < 0.22;
      nextBlinkTime = now + (isDoubleBlink ? 320 : 3000 + Math.random() * 2500);
    }

    let blinkValue = 0;
    if (blinkStartTime > 0) {
      const elapsed = now - blinkStartTime;
      if (elapsed >= 0 && elapsed < 160) {
        blinkValue = Math.sin((elapsed / 160) * Math.PI);
      } else {
        blinkStartTime = -1;
      }
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uBlink, blinkValue);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }
};

initBlinkingAvatar();
