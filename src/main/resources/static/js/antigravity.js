import { requestJSON } from "/js/api.js";

/**
 * Интерактивный физический движок "Google Antigravity Experience"
 * Реализует парение частиц в невесомости, отталкивание курсором (антигравитационное поле),
 * ударные гравитационные волны при клике и созвездия силовых линий.
 */

function initAntigravityPhysics() {
  const canvas = document.querySelector("#antigravity-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let dpr = window.devicePixelRatio || 1;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
  }

  window.addEventListener("resize", resize);
  resize();

  const PARTICLE_COUNT = Math.min(90, Math.max(45, Math.floor((width * height) / 16000)));
  const COLORS = [
    { r: 189, g: 147, b: 249 }, // Lavender #bd93f9
    { r: 255, g: 121, b: 198 }, // Pink #ff79c6
    { r: 139, g: 233, b: 253 }, // Cyan #8be9fd
    { r: 80,  g: 250, b: 123 }, // Green #50fa7b
    { r: 241, g: 250, b: 140 }  // Yellow #f1fa8c
  ];

  class Particle {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = initial ? Math.random() * height : (Math.random() < 0.5 ? -10 : height + 10);
      this.baseVx = (Math.random() - 0.5) * 0.45;
      this.baseVy = (Math.random() - 0.5) * 0.45;
      this.vx = this.baseVx;
      this.vy = this.baseVy;
      this.radius = 2.2 + Math.random() * 2.5;
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.alpha = 0.45 + Math.random() * 0.45;
      this.pulseSpeed = 0.02 + Math.random() * 0.03;
      this.pulseAngle = Math.random() * Math.PI * 2;
    }

    update(mouse, shockwaves) {
      // 1. Естественное парение в невесомости
      this.pulseAngle += this.pulseSpeed;
      const pulse = 1 + Math.sin(this.pulseAngle) * 0.25;

      // 2. Взаимодействие с курсором (Антигравитационное поле отталкивания)
      if (mouse.active) {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        const maxDist = 180;

        if (dist < maxDist && dist > 1) {
          // Сила отталкивания: чем ближе курсор, тем мощнее разлетаются частицы
          const force = (1 - dist / maxDist) * 3.8;
          const angle = Math.atan2(dy, dx);
          this.vx += Math.cos(angle) * force;
          this.vy += Math.sin(angle) * force;
        }
      }

      // 3. Ударные гравитационные волны (от кликов)
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        const dx = this.x - sw.x;
        const dy = this.y - sw.y;
        const dist = Math.hypot(dx, dy);
        const waveDist = Math.abs(dist - sw.radius);

        if (waveDist < 35 && dist > 1) {
          const force = (1 - waveDist / 35) * sw.strength;
          const angle = Math.atan2(dy, dx);
          this.vx += Math.cos(angle) * force;
          this.vy += Math.sin(angle) * force;
        }
      }

      // 4. Трение невесомости и возвращение к плавному дрейфу
      this.vx = this.vx * 0.94 + this.baseVx * 0.06;
      this.vy = this.vy * 0.94 + this.baseVy * 0.06;

      this.x += this.vx;
      this.y += this.vy;

      // Отражение от краев экрана
      if (this.x < 0) { this.x = 0; this.vx *= -1; }
      else if (this.x > width) { this.x = width; this.vx *= -1; }
      if (this.y < 0) { this.y = 0; this.vy *= -1; }
      else if (this.y > height) { this.y = height; this.vy *= -1; }
    }

    draw(ctx) {
      const { r, g, b } = this.color;
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${this.alpha})`;
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
    }
  }

  const particles = Array.from({ length: PARTICLE_COUNT }, () => new Particle());
  const mouse = { x: -1000, y: -1000, active: false };
  const shockwaves = [];

  window.addEventListener("pointermove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });

  window.addEventListener("pointerleave", () => {
    mouse.active = false;
  });

  // Клик по экрану создает расширяющуюся гравитационную волну
  window.addEventListener("pointerdown", (e) => {
    // Не создаем шоквейв, если кликнули по кнопкам или формам
    if (e.target.closest("button, a, input, select, textarea, .home-card")) return;
    shockwaves.push({
      x: e.clientX,
      y: e.clientY,
      radius: 10,
      maxRadius: 240,
      speed: 7,
      strength: 6.5,
      alpha: 0.8
    });
  });

  function render() {
    ctx.clearRect(0, 0, width, height);

    // Обновление и отрисовка ударных волн
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.radius += sw.speed;
      sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);

      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(189, 147, 249, ${sw.alpha * 0.45})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "rgba(255, 121, 198, 0.6)";
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();

      if (sw.radius >= sw.maxRadius || sw.alpha <= 0) {
        shockwaves.splice(i, 1);
      }
    }

    // Соединительные гравитационные нити (Constellation Web)
    const maxLinkDist = 125;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p1 = particles[i];
        const p2 = particles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.hypot(dx, dy);

        if (dist < maxLinkDist) {
          const lineAlpha = (1 - dist / maxLinkDist) * 0.22;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(189, 147, 249, ${lineAlpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // Обновление и отрисовка частиц
    for (const p of particles) {
      p.update(mouse, shockwaves);
      p.draw(ctx);
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

/**
 * Плавный счетчик чисел от 0 до целевого значения
 */
function animateValue(el, target, duration = 800) {
  if (!el || isNaN(target)) return;
  const start = 0;
  const t0 = performance.now();

  function step(now) {
    const progress = Math.min(1, (now - t0) / duration);
    // Функция плавности cubic ease-out
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * easeOut);
    el.textContent = String(current);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = String(target);
  }

  requestAnimationFrame(step);
}

/**
 * Загрузка актуальных системных счетчиков через REST API
 */
async function loadLiveHomeStats() {
  const elStudents = document.querySelector("#stat-students");
  const elGroups = document.querySelector("#stat-groups");
  const elSubjects = document.querySelector("#stat-subjects");

  try {
    const [groupsData, subjectsData, studentsData] = await Promise.all([
      requestJSON("/api/groups"),
      requestJSON("/api/subjects"),
      requestJSON("/api/students")
    ]);

    if (elGroups && groupsData?.items) {
      animateValue(elGroups, groupsData.items.length);
    }
    if (elSubjects && subjectsData?.items) {
      animateValue(elSubjects, subjectsData.items.length);
    }
    if (elStudents && studentsData?.items) {
      animateValue(elStudents, studentsData.items.length);
    }
  } catch (err) {
    console.warn("Ошибка загрузки живых счетчиков домашней страницы:", err);
    if (elStudents) elStudents.textContent = "60";
    if (elGroups) elGroups.textContent = "3";
    if (elSubjects) elSubjects.textContent = "3";
  }
}

/**
 * Инициализация быстрых триггеров на домашней странице
 */
function initHomeTriggers() {
  const btnTerm = document.querySelector("#home-open-term");
  const btnPalette = document.querySelector("#home-open-palette");
  const cardXray = document.querySelector("#card-trigger-xray");

  if (btnTerm) {
    btnTerm.addEventListener("click", () => {
      document.querySelector("#term-toggle-btn")?.click();
    });
  }

  if (btnPalette) {
    btnPalette.addEventListener("click", () => {
      document.querySelector("#cmd-palette-btn")?.click();
    });
  }

  if (cardXray) {
    cardXray.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#xray-toggle-btn")?.click();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initAntigravityPhysics();
  loadLiveHomeStats();
  initHomeTriggers();
});
