"use strict";

const button = document.querySelector("#hello-button");
const message = document.querySelector("#message");
const hint = document.querySelector("#hint");
const canvas = document.querySelector("#fireworks");
const context = canvas.getContext("2d");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const colors = ["#9871f5", "#ffc66f", "#f18db1", "#70d7c7", "#bba4ff"];
let particles = [];
let animationFrame = null;
let previousTime = null;
let celebrationStart = null;
let nextBurst = 0;
let width = 0;
let height = 0;

function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function burst(x, y) {
  for (let i = 0; i < 55; i += 1) {
    const angle = (Math.PI * 2 * i) / 55;
    const speed = 65 + Math.random() * 170;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      duration: .8 + Math.random() * .7,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 1.5 + Math.random() * 2,
    });
  }
}

function stopFireworks() {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  previousTime = null;
  celebrationStart = null;
  particles = [];
  context?.clearRect(0, 0, width, height);
}

function animate(time) {
  if (celebrationStart === null) celebrationStart = time;
  const elapsed = time - celebrationStart;
  const delta = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, .04);
  previousTime = time;
  context.clearRect(0, 0, width, height);

  if (elapsed >= nextBurst && nextBurst < 1500) {
    burst(width * (.15 + Math.random() * .7), height * (.15 + Math.random() * .4));
    nextBurst += 250;
  }

  particles = particles.filter((particle) => {
    particle.life += delta;
    if (particle.life >= particle.duration) return false;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 95 * delta;
    context.globalAlpha = 1 - particle.life / particle.duration;
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();
    return true;
  });
  context.globalAlpha = 1;

  if (particles.length > 0 || nextBurst < 1500) {
    animationFrame = requestAnimationFrame(animate);
  } else {
    stopFireworks();
  }
}

button.addEventListener("click", () => {
  message.hidden = false;
  message.classList.remove("reveal");
  // Restart the reveal animation, including on consecutive taps.
  void message.offsetWidth;
  message.classList.add("reveal");
  button.innerHTML = 'Encore un peu de magie <span aria-hidden="true">↗</span>';
  hint.textContent = "C’est aussi simple que ça. Et ce n’est que le début.";
  stopFireworks();
  if (context && !reducedMotion.matches) {
    nextBurst = 0;
    animationFrame = requestAnimationFrame(animate);
  }
});

window.addEventListener("resize", resizeCanvas);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopFireworks();
});
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) stopFireworks();
});
resizeCanvas();

async function prepareOfflineMode() {
  const status = document.querySelector("#offline-status");
  if (!("serviceWorker" in navigator)) {
    status.textContent = "Mode hors ligne indisponible dans ce navigateur.";
    return;
  }
  if (!window.isSecureContext) {
    status.textContent = "Le mode hors ligne nécessite HTTPS ou localhost.";
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register("./sw.js");
    if (!registration.active) {
      const worker = registration.installing || registration.waiting;
      if (!worker) throw new Error("Aucun service worker disponible.");
      await new Promise((resolve, reject) => {
        const checkState = () => {
          if (worker.state === "activated") {
            worker.removeEventListener("statechange", checkState);
            resolve();
          } else if (worker.state === "redundant") {
            worker.removeEventListener("statechange", checkState);
            reject(new Error("Installation du cache hors ligne échouée."));
          }
        };
        worker.addEventListener("statechange", checkState);
        checkState();
      });
    }
    await navigator.serviceWorker.ready;
    status.textContent = "Prête à fonctionner hors ligne";
  } catch (error) {
    console.error("Impossible de préparer le mode hors ligne :", error);
    status.textContent = "Mode hors ligne indisponible. Rechargez avec une connexion.";
  }
}

prepareOfflineMode();
