// ── Setup ──────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// ── World State ────────────────────────────────────────────
const planets = createPlanets();
const ship = createShip(planets);
const camera = { x: ship.x, y: ship.y, zoom: 1.0 };
const keys = { up: false, down: false, left: false, right: false };
let gameTime = 0;
let showHelp = true;
let helpTimer = 10;

// ── Starfield ──────────────────────────────────────────────
const stars = [];
for (let i = 0; i < 300; i++) {
    stars.push({
        x: (Math.random() - 0.5) * 20000,
        y: (Math.random() - 0.5) * 20000,
        size: Math.random() * 1.5 + 0.5,
        brightness: Math.random() * 0.5 + 0.5,
    });
}

// ── Input ──────────────────────────────────────────────────
function keyHandler(e, pressed) {
    switch (e.code) {
        case 'ArrowUp':    case 'KeyW': keys.up = pressed; break;
        case 'ArrowDown':  case 'KeyS': keys.down = pressed; break;
        case 'ArrowLeft':  case 'KeyA': keys.left = pressed; break;
        case 'ArrowRight': case 'KeyD': keys.right = pressed; break;
        case 'KeyR': if (pressed) resetShip(ship, planets); break;
    }
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
        e.preventDefault();
    }
}
window.addEventListener('keydown', e => keyHandler(e, true));
window.addEventListener('keyup', e => keyHandler(e, false));

window.addEventListener('wheel', e => {
    camera.zoom *= e.deltaY > 0 ? 0.9 : 1.1;
    camera.zoom = Math.max(0.05, Math.min(5, camera.zoom));
    e.preventDefault();
}, { passive: false });

// ── Coordinate Transform ───────────────────────────────────
function worldToScreen(wx, wy) {
    return {
        x: (wx - camera.x) * camera.zoom + canvas.width / 2,
        y: (wy - camera.y) * camera.zoom + canvas.height / 2,
    };
}

// ── Rendering ──────────────────────────────────────────────
function drawStarfield() {
    const parallax = 0.1;
    for (const s of stars) {
        const sx = (s.x - camera.x * parallax) * camera.zoom + canvas.width / 2;
        const sy = (s.y - camera.y * parallax) * camera.zoom + canvas.height / 2;
        // Wrap stars to always be visible
        const wx = ((sx % canvas.width) + canvas.width) % canvas.width;
        const wy = ((sy % canvas.height) + canvas.height) % canvas.height;
        const alpha = s.brightness * (0.7 + 0.3 * Math.sin(gameTime * 2 + s.x));
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(wx, wy, s.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawPlanet(p) {
    const scr = worldToScreen(p.x, p.y);
    const r = p.radius * camera.zoom;

    // Skip if off screen
    if (scr.x + r < -50 || scr.x - r > canvas.width + 50 ||
        scr.y + r < -50 || scr.y - r > canvas.height + 50) return;

    // Glow
    if (r > 3) {
        const glowGrad = ctx.createRadialGradient(scr.x, scr.y, r, scr.x, scr.y, r * 1.5);
        glowGrad.addColorStop(0, p.glow + '40');
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, r * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Body with gradient
    const grad = ctx.createRadialGradient(scr.x - r * 0.3, scr.y - r * 0.3, r * 0.1, scr.x, scr.y, r);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.3, p.color);
    grad.addColorStop(1, p.glow);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(scr.x, scr.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Name label
    if (r > 5) {
        ctx.fillStyle = '#aaa';
        ctx.font = `${Math.max(10, Math.min(14, r * 0.5))}px 'Courier New', monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(p.name, scr.x, scr.y + r + 16);
    }
}

function drawShip() {
    if (ship.crashed) {
        // Draw explosion
        const scr = worldToScreen(ship.x, ship.y);
        const t = 1 - ship.crashTimer / 1.5;
        const exSize = 20 + t * 40;
        const grad = ctx.createRadialGradient(scr.x, scr.y, 0, scr.x, scr.y, exSize * camera.zoom);
        grad.addColorStop(0, `rgba(255, 200, 50, ${1 - t})`);
        grad.addColorStop(0.5, `rgba(255, 100, 0, ${0.6 * (1 - t)})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, exSize * camera.zoom, 0, Math.PI * 2);
        ctx.fill();
        return;
    }

    const scr = worldToScreen(ship.x, ship.y);
    const size = SHIP_RADIUS * camera.zoom;
    const angle = ship.angle;

    ctx.save();
    ctx.translate(scr.x, scr.y);
    ctx.rotate(angle);

    // Thrust flame
    if ((ship.thrustOn || ship.retroOn) && !ship.landed) {
        const flicker = 0.7 + Math.random() * 0.6;
        const flameLen = size * 2 * flicker;

        ctx.save();
        if (ship.retroOn && !ship.thrustOn) {
            // Retrograde flame comes from front
            ctx.fillStyle = '#4488ff';
            ctx.beginPath();
            ctx.moveTo(size * 0.8, -size * 0.3);
            ctx.lineTo(size * 0.8, size * 0.3);
            ctx.lineTo(size * 0.8 + flameLen * 0.5, 0);
            ctx.fill();
        }
        if (ship.thrustOn) {
            // Main engine flame
            const flameGrad = ctx.createLinearGradient(-size, 0, -size - flameLen, 0);
            flameGrad.addColorStop(0, '#fff');
            flameGrad.addColorStop(0.2, '#ffaa00');
            flameGrad.addColorStop(0.6, '#ff4400');
            flameGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = flameGrad;
            ctx.beginPath();
            ctx.moveTo(-size * 0.6, -size * 0.4);
            ctx.lineTo(-size * 0.6, size * 0.4);
            ctx.lineTo(-size - flameLen, 0);
            ctx.fill();
        }
        ctx.restore();
    }

    // Ship body (triangle)
    ctx.fillStyle = '#e0e0e0';
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.7, -size * 0.6);
    ctx.lineTo(-size * 0.4, 0);
    ctx.lineTo(-size * 0.7, size * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

function drawPredictionLine() {
    const trajectory = predictTrajectory(ship, planets);
    if (trajectory.length === 0) return;

    ctx.beginPath();
    const first = worldToScreen(trajectory[0].x, trajectory[0].y);
    ctx.moveTo(first.x, first.y);

    for (let i = 1; i < trajectory.length; i++) {
        const pt = worldToScreen(trajectory[i].x, trajectory[i].y);
        if (i % 3 === 0) {
            ctx.strokeStyle = `rgba(100, 200, 255, ${0.4 * (1 - i / trajectory.length)})`;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y);
        } else {
            ctx.lineTo(pt.x, pt.y);
        }
    }
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.1)';
    ctx.stroke();
}

function drawMinimap() {
    const mw = 200, mh = 200;
    const mx = canvas.width - mw - 15;
    const my = 15;

    // Find bounds of all planets
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of planets) {
        minX = Math.min(minX, p.x - p.radius);
        maxX = Math.max(maxX, p.x + p.radius);
        minY = Math.min(minY, p.y - p.radius);
        maxY = Math.max(maxY, p.y + p.radius);
    }
    const padding = 200;
    minX -= padding; maxX += padding; minY -= padding; maxY += padding;
    const scaleX = mw / (maxX - minX);
    const scaleY = mh / (maxY - minY);
    const scale = Math.min(scaleX, scaleY);

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    function miniPos(wx, wy) {
        return {
            x: mx + mw / 2 + (wx - cx) * scale,
            y: my + mh / 2 + (wy - cy) * scale,
        };
    }

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeRect(mx, my, mw, mh);

    // Planets
    for (const p of planets) {
        const mp = miniPos(p.x, p.y);
        const r = Math.max(2, p.radius * scale);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(mp.x, mp.y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // Ship
    const sp = miniPos(ship.x, ship.y);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // View rectangle
    const viewW = canvas.width / camera.zoom;
    const viewH = canvas.height / camera.zoom;
    const vtl = miniPos(camera.x - viewW / 2, camera.y - viewH / 2);
    const vbr = miniPos(camera.x + viewW / 2, camera.y + viewH / 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.strokeRect(vtl.x, vtl.y, vbr.x - vtl.x, vbr.y - vtl.y);
}

function drawUI() {
    const info = getOrbitInfo(ship, planets);
    const lh = 20; // line height
    let y = 30;

    ctx.font = '14px "Courier New", monospace';
    ctx.textAlign = 'left';

    // Fuel bar
    const barX = 20, barY = y - 12, barW = 150, barH = 16;
    const fuelPct = ship.fuel / FUEL_MAX;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX, barY, barW, barH);
    const fuelColor = fuelPct > 0.5 ? '#4CAF50' : fuelPct > 0.2 ? '#FF9800' : '#F44336';
    ctx.fillStyle = fuelColor;
    ctx.fillRect(barX, barY, barW * fuelPct, barH);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillStyle = '#fff';
    ctx.fillText(`FUEL: ${Math.ceil(ship.fuel)}%`, barX + barW + 10, y);
    y += lh + 8;

    // Speed
    if (info) {
        ctx.fillStyle = '#aaa';
        ctx.fillText(`SPEED: ${info.speed.toFixed(1)} u/s`, 20, y);
        y += lh;

        ctx.fillText(`ALT: ${Math.max(0, info.altitude).toFixed(0)} (${info.planet.name})`, 20, y);
        y += lh;

        if (info.orbiting) {
            ctx.fillStyle = '#4CAF50';
            ctx.fillText(`ORBITING ${info.planet.name.toUpperCase()}`, 20, y);
        } else {
            ctx.fillStyle = '#888';
            ctx.fillText('ESCAPE TRAJECTORY', 20, y);
        }
        y += lh;
    }

    // Landing / crash status
    if (ship.landed) {
        ctx.fillStyle = '#4CAF50';
        ctx.font = '18px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`LANDED on ${ship.landed.name}`, canvas.width / 2, canvas.height - 60);
        ctx.font = '14px "Courier New", monospace';
        ctx.fillStyle = '#888';
        ctx.fillText('Press W or UP to launch', canvas.width / 2, canvas.height - 38);
    }

    if (ship.crashed) {
        ctx.fillStyle = '#F44336';
        ctx.font = 'bold 28px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CRASH!', canvas.width / 2, canvas.height / 2);
        ctx.font = '14px "Courier New", monospace';
        ctx.fillStyle = '#888';
        ctx.fillText('Respawning...', canvas.width / 2, canvas.height / 2 + 28);
    }

    // Controls help
    if (showHelp) {
        const alpha = helpTimer > 2 ? 0.7 : helpTimer * 0.35;
        ctx.fillStyle = `rgba(170, 170, 170, ${alpha})`;
        ctx.font = '12px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('W/S: Thrust/Brake  |  A/D: Rotate  |  Scroll: Zoom  |  R: Reset', canvas.width / 2, canvas.height - 15);
    }
}

// ── Game Loop ──────────────────────────────────────────────
let lastTime = 0;

function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;
    gameTime += dt;

    // Help timer
    if (showHelp) {
        helpTimer -= dt;
        if (helpTimer <= 0) showHelp = false;
    }

    // Update physics
    updateShip(ship, planets, keys, dt);

    // Camera follow
    camera.x += (ship.x - camera.x) * 0.05;
    camera.y += (ship.y - camera.y) * 0.05;

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw world
    drawStarfield();
    drawPredictionLine();
    for (const p of planets) drawPlanet(p);
    drawShip();

    // Draw UI
    drawMinimap();
    drawUI();

    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
