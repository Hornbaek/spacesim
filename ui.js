// ── Solar System Map ───────────────────────────────────────
const mapCanvas = document.getElementById('mapCanvas');
const mapCtx = mapCanvas.getContext('2d');
const mapOverlay = document.getElementById('solar-map');

let mapScale = 1;
let mapCenterX = 0;
let mapCenterY = 0;
let mapOffsetX = 0;
let mapOffsetY = 0;

// Canvas-drawn UI regions (for click hit-testing)
const MAP_HEADER_H = 44;
const MAP_FOOTER_H = 32;
const mapButtons = {
    clearRoute: { x: 0, y: 0, w: 0, h: 0 },
    close:      { x: 0, y: 0, w: 0, h: 0 },
};

function resizeMapCanvas() {
    // Let CSS flex layout determine the display size, then match canvas resolution
    mapCanvas.style.width = '100%';
    mapCanvas.style.height = '100%';
    const rect = mapCanvas.getBoundingClientRect();
    mapCanvas.width = rect.width;
    mapCanvas.height = rect.height;
}

function computeMapTransform() {
    // Bounding box of all planets + moons
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of planets) {
        minX = Math.min(minX, p.x - p.radius);
        maxX = Math.max(maxX, p.x + p.radius);
        minY = Math.min(minY, p.y - p.radius);
        maxY = Math.max(maxY, p.y + p.radius);
    }
    for (const m of moons) {
        minX = Math.min(minX, m.x - m.radius);
        maxX = Math.max(maxX, m.x + m.radius);
        minY = Math.min(minY, m.y - m.radius);
        maxY = Math.max(maxY, m.y + m.radius);
    }
    const padding = 2000;
    minX -= padding; maxX += padding;
    minY -= padding; maxY += padding;

    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    // Use the drawable area between header and footer
    const drawH = mapCanvas.height - MAP_HEADER_H - MAP_FOOTER_H;
    const scaleX = mapCanvas.width / rangeX;
    const scaleY = drawH / rangeY;
    mapScale = Math.min(scaleX, scaleY);

    mapCenterX = (minX + maxX) / 2;
    mapCenterY = (minY + maxY) / 2;
    mapOffsetX = mapCanvas.width / 2;
    mapOffsetY = MAP_HEADER_H + drawH / 2;
}

function worldToMap(wx, wy) {
    return {
        x: (wx - mapCenterX) * mapScale + mapOffsetX,
        y: (wy - mapCenterY) * mapScale + mapOffsetY,
    };
}

function mapToWorld(mx, my) {
    return {
        x: (mx - mapOffsetX) / mapScale + mapCenterX,
        y: (my - mapOffsetY) / mapScale + mapCenterY,
    };
}

function getRouteText() {
    if (route.length === 0) return 'No route plotted';
    let totalDist = 0;
    let prevX = ship.x, prevY = ship.y;
    for (const wp of route) {
        totalDist += Math.sqrt((wp.x - prevX) ** 2 + (wp.y - prevY) ** 2);
        prevX = wp.x;
        prevY = wp.y;
    }
    return `${route.length} waypoint${route.length > 1 ? 's' : ''} | ${totalDist.toFixed(0)} units`;
}

function renderMap() {
    const w = mapCanvas.width;
    const h = mapCanvas.height;
    mapCtx.clearRect(0, 0, w, h);

    computeMapTransform();

    // ── Grid lines ────────────────────────────────────────
    mapCtx.save();
    mapCtx.beginPath();
    mapCtx.rect(0, MAP_HEADER_H, w, h - MAP_HEADER_H - MAP_FOOTER_H);
    mapCtx.clip();

    mapCtx.strokeStyle = 'rgba(0, 180, 216, 0.06)';
    mapCtx.lineWidth = 1;
    const gridSpacing = 2000;
    const gridStartX = Math.floor((mapCenterX - w / mapScale / 2) / gridSpacing) * gridSpacing;
    const gridStartY = Math.floor((mapCenterY - h / mapScale / 2) / gridSpacing) * gridSpacing;
    for (let gx = gridStartX; gx < mapCenterX + w / mapScale / 2; gx += gridSpacing) {
        const sx = worldToMap(gx, 0).x;
        mapCtx.beginPath();
        mapCtx.moveTo(sx, MAP_HEADER_H);
        mapCtx.lineTo(sx, h - MAP_FOOTER_H);
        mapCtx.stroke();
    }
    for (let gy = gridStartY; gy < mapCenterY + h / mapScale / 2; gy += gridSpacing) {
        const sy = worldToMap(0, gy).y;
        mapCtx.beginPath();
        mapCtx.moveTo(0, sy);
        mapCtx.lineTo(w, sy);
        mapCtx.stroke();
    }

    // ── Moon orbit circles ────────────────────────────────
    for (const m of moons) {
        const parent = planets.find(p => p.name === m.orbit.parent);
        const ps = worldToMap(parent.x, parent.y);
        const orbitR = m.orbit.distance * mapScale;
        mapCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        mapCtx.lineWidth = 1;
        mapCtx.setLineDash([3, 6]);
        mapCtx.beginPath();
        mapCtx.arc(ps.x, ps.y, orbitR, 0, Math.PI * 2);
        mapCtx.stroke();
        mapCtx.setLineDash([]);
    }

    // ── Planets ───────────────────────────────────────────
    for (const p of planets) {
        const ps = worldToMap(p.x, p.y);
        const r = Math.max(8, p.radius * mapScale);

        // Glow
        const glowR = Math.min(r * 2, 40);
        const glowGrad = mapCtx.createRadialGradient(ps.x, ps.y, r * 0.5, ps.x, ps.y, glowR);
        glowGrad.addColorStop(0, p.glow + '30');
        glowGrad.addColorStop(1, 'transparent');
        mapCtx.fillStyle = glowGrad;
        mapCtx.beginPath();
        mapCtx.arc(ps.x, ps.y, glowR, 0, Math.PI * 2);
        mapCtx.fill();

        // Body
        mapCtx.fillStyle = p.color;
        mapCtx.beginPath();
        mapCtx.arc(ps.x, ps.y, r, 0, Math.PI * 2);
        mapCtx.fill();

        // Name
        mapCtx.fillStyle = '#8ab0c8';
        mapCtx.font = '12px "Courier New", monospace';
        mapCtx.textAlign = 'center';
        mapCtx.fillText(p.name, ps.x, ps.y + r + 16);
    }

    // ── Moons ─────────────────────────────────────────────
    for (const m of moons) {
        const ms = worldToMap(m.x, m.y);
        const r = Math.max(4, m.radius * mapScale);
        mapCtx.fillStyle = m.color;
        mapCtx.beginPath();
        mapCtx.arc(ms.x, ms.y, r, 0, Math.PI * 2);
        mapCtx.fill();

        mapCtx.fillStyle = '#6a8a9a';
        mapCtx.font = '10px "Courier New", monospace';
        mapCtx.textAlign = 'center';
        mapCtx.fillText(m.name, ms.x, ms.y + r + 12);
    }

    // ── Route line ────────────────────────────────────────
    if (route.length > 0) {
        mapCtx.save();
        mapCtx.setLineDash([8, 6]);
        mapCtx.lineWidth = 2;
        mapCtx.strokeStyle = 'rgba(0, 220, 180, 0.7)';
        mapCtx.beginPath();

        const ss = worldToMap(ship.x, ship.y);
        mapCtx.moveTo(ss.x, ss.y);

        for (const wp of route) {
            const ws = worldToMap(wp.x, wp.y);
            mapCtx.lineTo(ws.x, ws.y);
        }
        mapCtx.stroke();
        mapCtx.setLineDash([]);

        // Waypoint markers
        for (let i = 0; i < route.length; i++) {
            const ws = worldToMap(route[i].x, route[i].y);
            mapCtx.fillStyle = 'rgba(0, 220, 180, 0.9)';
            mapCtx.beginPath();
            mapCtx.arc(ws.x, ws.y, 8, 0, Math.PI * 2);
            mapCtx.fill();

            mapCtx.fillStyle = '#000';
            mapCtx.font = 'bold 10px "Courier New", monospace';
            mapCtx.textAlign = 'center';
            mapCtx.textBaseline = 'middle';
            mapCtx.fillText(i + 1, ws.x, ws.y);
        }
        mapCtx.textBaseline = 'alphabetic';
        mapCtx.restore();
    }

    // ── Ship position ─────────────────────────────────────
    const ss = worldToMap(ship.x, ship.y);
    mapCtx.fillStyle = '#fff';
    mapCtx.beginPath();
    mapCtx.arc(ss.x, ss.y, 5, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.fillStyle = '#00b4d8';
    mapCtx.font = '10px "Courier New", monospace';
    mapCtx.textAlign = 'center';
    mapCtx.fillText('SHIP', ss.x, ss.y - 10);

    mapCtx.restore(); // end clip

    // ── Header bar (drawn on canvas) ──────────────────────
    mapCtx.fillStyle = 'rgba(10, 22, 40, 0.98)';
    mapCtx.fillRect(0, 0, w, MAP_HEADER_H);
    mapCtx.strokeStyle = 'rgba(0, 180, 216, 0.3)';
    mapCtx.lineWidth = 1;
    mapCtx.beginPath();
    mapCtx.moveTo(0, MAP_HEADER_H);
    mapCtx.lineTo(w, MAP_HEADER_H);
    mapCtx.stroke();

    // Title
    mapCtx.fillStyle = '#00b4d8';
    mapCtx.font = '16px "Courier New", monospace';
    mapCtx.textAlign = 'left';
    mapCtx.fillText('NAVIGATION MAP', 20, MAP_HEADER_H / 2 + 5);

    // Buttons — draw and store hit regions
    const btnH = 28;
    const btnY = (MAP_HEADER_H - btnH) / 2;
    const btnFont = '13px "Courier New", monospace';
    mapCtx.font = btnFont;

    // CLOSE [M] button (right side)
    const closeText = 'CLOSE [M]';
    const closeTW = mapCtx.measureText(closeText).width;
    const closeBtnW = closeTW + 36;
    const closeBtnX = w - closeBtnW - 20;
    mapButtons.close = { x: closeBtnX, y: btnY, w: closeBtnW, h: btnH };

    mapCtx.strokeStyle = '#00b4d8';
    mapCtx.fillStyle = 'rgba(0, 180, 216, 0.2)';
    mapCtx.fillRect(closeBtnX, btnY, closeBtnW, btnH);
    mapCtx.strokeRect(closeBtnX, btnY, closeBtnW, btnH);
    mapCtx.fillStyle = '#00e0ff';
    mapCtx.textAlign = 'center';
    mapCtx.fillText(closeText, closeBtnX + closeBtnW / 2, btnY + btnH / 2 + 5);

    // CLEAR ROUTE button
    const clearText = 'CLEAR ROUTE';
    const clearTW = mapCtx.measureText(clearText).width;
    const clearBtnW = clearTW + 36;
    const clearBtnX = closeBtnX - clearBtnW - 10;
    mapButtons.clearRoute = { x: clearBtnX, y: btnY, w: clearBtnW, h: btnH };

    mapCtx.strokeStyle = '#00b4d8';
    mapCtx.fillStyle = 'rgba(0, 180, 216, 0.2)';
    mapCtx.fillRect(clearBtnX, btnY, clearBtnW, btnH);
    mapCtx.strokeRect(clearBtnX, btnY, clearBtnW, btnH);
    mapCtx.fillStyle = '#00e0ff';
    mapCtx.textAlign = 'center';
    mapCtx.fillText(clearText, clearBtnX + clearBtnW / 2, btnY + btnH / 2 + 5);

    // ── Footer bar (drawn on canvas) ──────────────────────
    const footerY = h - MAP_FOOTER_H;
    mapCtx.fillStyle = 'rgba(10, 22, 40, 0.98)';
    mapCtx.fillRect(0, footerY, w, MAP_FOOTER_H);
    mapCtx.strokeStyle = 'rgba(0, 180, 216, 0.3)';
    mapCtx.lineWidth = 1;
    mapCtx.beginPath();
    mapCtx.moveTo(0, footerY);
    mapCtx.lineTo(w, footerY);
    mapCtx.stroke();

    // Footer text
    mapCtx.font = '12px "Courier New", monospace';
    mapCtx.textAlign = 'left';
    mapCtx.fillStyle = '#6a8a9a';
    mapCtx.fillText('Click to add waypoints | Click waypoint to remove', 20, footerY + MAP_FOOTER_H / 2 + 4);

    mapCtx.textAlign = 'right';
    mapCtx.fillStyle = '#00dca0';
    mapCtx.fillText(getRouteText(), w - 20, footerY + MAP_FOOTER_H / 2 + 4);
}

// ── Map Click Handling ─────────────────────────────────────
mapCanvas.addEventListener('click', (e) => {
    const rect = mapCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Check header button clicks
    const cb = mapButtons.close;
    if (mx >= cb.x && mx <= cb.x + cb.w && my >= cb.y && my <= cb.y + cb.h) {
        toggleMap();
        return;
    }
    const cr = mapButtons.clearRoute;
    if (mx >= cr.x && mx <= cr.x + cr.w && my >= cr.y && my <= cr.y + cr.h) {
        route.length = 0;
        renderMap();
        return;
    }

    // Ignore clicks on header/footer areas
    if (my < MAP_HEADER_H || my > mapCanvas.height - MAP_FOOTER_H) return;

    // Check if clicking near an existing waypoint (remove it)
    for (let i = route.length - 1; i >= 0; i--) {
        const ws = worldToMap(route[i].x, route[i].y);
        if (Math.hypot(mx - ws.x, my - ws.y) < 15) {
            route.splice(i, 1);
            renderMap();
            return;
        }
    }

    // Check if clicking on a planet or moon (snap to center)
    const allBodies = [...planets, ...moons];
    for (const body of allBodies) {
        const bs = worldToMap(body.x, body.y);
        const drawR = Math.max(body.radius * mapScale, 8);
        if (Math.hypot(mx - bs.x, my - bs.y) < drawR + 5) {
            route.push({ x: body.x, y: body.y, name: body.name });
            renderMap();
            return;
        }
    }

    // Add waypoint at clicked position
    const world = mapToWorld(mx, my);
    route.push({ x: world.x, y: world.y });
    renderMap();
});

// ── Toggle Functions ───────────────────────────────────────
function toggleMap() {
    mapOpen = !mapOpen;
    gamePaused = mapOpen;
    if (mapOpen) {
        canvas.style.display = 'none';
        mapOverlay.classList.remove('hidden');
        requestAnimationFrame(() => {
            resizeMapCanvas();
            renderMap();
        });
    } else {
        mapOverlay.classList.add('hidden');
        canvas.style.display = 'block';
        keys.up = false;
        keys.down = false;
        keys.left = false;
        keys.right = false;
    }
}

function togglePanel() {
    panelOpen = !panelOpen;
    const panel = document.getElementById('game-panel');
    if (panelOpen) {
        panel.classList.remove('hidden');
        updatePanel();
        if (!panelInterval) {
            panelInterval = setInterval(updatePanel, 500);
        }
    } else {
        panel.classList.add('hidden');
        if (panelInterval) {
            clearInterval(panelInterval);
            panelInterval = null;
        }
    }
}

// ── Panel Tab Switching ────────────────────────────────────
const tabButtons = document.querySelectorAll('.panel-tabs button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
});

// ── Inventory Grid (fill with empty slots) ─────────────────
const invGrid = document.getElementById('inv-grid');
for (let i = 0; i < 20; i++) {
    const slot = document.createElement('div');
    slot.className = 'inv-slot';
    slot.textContent = 'EMPTY';
    invGrid.appendChild(slot);
}

// ── Panel Update ───────────────────────────────────────────
let panelInterval = null;

function updatePanel() {
    if (!panelOpen) return;

    const info = getOrbitInfo(ship, planets, moons);
    document.getElementById('nav-x').textContent = ship.x.toFixed(0);
    document.getElementById('nav-y').textContent = ship.y.toFixed(0);

    if (info) {
        document.getElementById('nav-speed').textContent = info.speed.toFixed(1) + ' u/s';
        document.getElementById('nav-nearest').textContent = info.planet.name;
        document.getElementById('nav-dist').textContent = info.altitude.toFixed(0);
    } else {
        document.getElementById('nav-speed').textContent = ship.landed ? 'Landed' : '---';
        document.getElementById('nav-nearest').textContent = ship.landed ? ship.landed.name : '---';
        document.getElementById('nav-dist').textContent = ship.landed ? 'Surface' : '---';
    }

    // Route summary
    document.getElementById('nav-wps').textContent = route.length;

    if (route.length > 0) {
        let totalDist = 0;
        let prevX = ship.x, prevY = ship.y;
        for (const wp of route) {
            totalDist += Math.sqrt((wp.x - prevX) ** 2 + (wp.y - prevY) ** 2);
            prevX = wp.x;
            prevY = wp.y;
        }
        document.getElementById('nav-rdist').textContent = totalDist.toFixed(0) + ' u';

        const listEl = document.getElementById('nav-route-list');
        listEl.innerHTML = '';
        for (let i = 0; i < route.length; i++) {
            const wp = route[i];
            const div = document.createElement('div');
            div.className = 'route-wp';
            const label = wp.name || `(${wp.x.toFixed(0)}, ${wp.y.toFixed(0)})`;
            div.innerHTML = `<span class="wp-num">#${i + 1}</span><span>${label}</span>`;
            listEl.appendChild(div);
        }
    } else {
        document.getElementById('nav-rdist').textContent = '---';
        document.getElementById('nav-route-list').innerHTML = '';
    }
}

// ── Resize Handling ────────────────────────────────────────
window.addEventListener('resize', () => {
    if (mapOpen) {
        resizeMapCanvas();
        renderMap();
    }
});
