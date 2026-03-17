// ── Constants ──────────────────────────────────────────────
const G = 30;
const THRUST_POWER = 150;
const ROTATION_SPEED = 3.0;
const FUEL_MAX = 100;
const FUEL_RATE = 4;
const SAFE_LANDING_SPEED = 50;
const SHIP_RADIUS = 8;
const PREDICTION_STEPS = 500;
const PREDICTION_DT = 0.1;

// ── Planets ────────────────────────────────────────────────
function createPlanets() {
    return [
        { name: 'Sol',     x: 0,     y: 0,     radius: 80, mass: 50000, color: '#FFD700', glow: '#FFA500' },
        { name: 'Mercury', x: 600,   y: 0,     radius: 15, mass: 800,   color: '#A0522D', glow: '#8B4513' },
        { name: 'Terra',   x: 0,     y: -1200, radius: 30, mass: 3000,  color: '#4169E1', glow: '#1E90FF' },
        { name: 'Mars',    x: -2000, y: 400,   radius: 22, mass: 1500,  color: '#CD5C5C', glow: '#B22222' },
        { name: 'Jupiter', x: 1500,  y: 2500,  radius: 55, mass: 20000, color: '#DAA520', glow: '#B8860B' },
        { name: 'Pluto',   x: -3500, y: -3000, radius: 10, mass: 400,   color: '#B0C4DE', glow: '#778899' },
    ];
}

// ── Ship ───────────────────────────────────────────────────
function createShip(planets) {
    const terra = planets.find(p => p.name === 'Terra');
    return {
        x: terra.x,
        y: terra.y - terra.radius - SHIP_RADIUS - 2,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2, // pointing up
        fuel: FUEL_MAX,
        thrustOn: false,
        retroOn: false,
        landed: terra,
        crashed: false,
        crashTimer: 0,
    };
}

function resetShip(ship, planets) {
    const terra = planets.find(p => p.name === 'Terra');
    ship.x = terra.x;
    ship.y = terra.y - terra.radius - SHIP_RADIUS - 2;
    ship.vx = 0;
    ship.vy = 0;
    ship.angle = -Math.PI / 2;
    ship.fuel = FUEL_MAX;
    ship.thrustOn = false;
    ship.retroOn = false;
    ship.landed = terra;
    ship.crashed = false;
    ship.crashTimer = 0;
}

// ── Gravity ────────────────────────────────────────────────
function computeGravity(x, y, planets) {
    let ax = 0, ay = 0;
    for (const p of planets) {
        const dx = p.x - x;
        const dy = p.y - y;
        let distSq = dx * dx + dy * dy;
        const minDist = p.radius * 0.5;
        distSq = Math.max(distSq, minDist * minDist);
        const dist = Math.sqrt(distSq);
        const accel = G * p.mass / distSq;
        ax += accel * (dx / dist);
        ay += accel * (dy / dist);
    }
    return { ax, ay };
}

// ── Ship Update ────────────────────────────────────────────
function updateShip(ship, planets, keys, dt) {
    // Handle crash timer
    if (ship.crashed) {
        ship.crashTimer -= dt;
        if (ship.crashTimer <= 0) {
            resetShip(ship, planets);
        }
        return;
    }

    // Rotation
    if (keys.left) ship.angle -= ROTATION_SPEED * dt;
    if (keys.right) ship.angle += ROTATION_SPEED * dt;

    // If landed, only allow takeoff
    if (ship.landed) {
        // Stick to planet surface
        const p = ship.landed;
        const surfaceAngle = Math.atan2(ship.y - p.y, ship.x - p.x);
        ship.x = p.x + Math.cos(surfaceAngle) * (p.radius + SHIP_RADIUS + 1);
        ship.y = p.y + Math.sin(surfaceAngle) * (p.radius + SHIP_RADIUS + 1);
        ship.vx = 0;
        ship.vy = 0;

        if (keys.up && ship.fuel > 0) {
            // Takeoff
            ship.landed = null;
            ship.vx = Math.cos(ship.angle) * 40;
            ship.vy = Math.sin(ship.angle) * 40;
        }
        return;
    }

    // Gravity
    const grav = computeGravity(ship.x, ship.y, planets);
    let ax = grav.ax;
    let ay = grav.ay;

    // Thrust
    ship.thrustOn = keys.up && ship.fuel > 0;
    ship.retroOn = keys.down && ship.fuel > 0;

    if (ship.thrustOn) {
        ax += Math.cos(ship.angle) * THRUST_POWER;
        ay += Math.sin(ship.angle) * THRUST_POWER;
        ship.fuel -= FUEL_RATE * dt;
    }
    if (ship.retroOn) {
        const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
        if (speed > 0.1) {
            ax -= (ship.vx / speed) * THRUST_POWER * 0.6;
            ay -= (ship.vy / speed) * THRUST_POWER * 0.6;
        }
        ship.fuel -= FUEL_RATE * 0.6 * dt;
    }
    ship.fuel = Math.max(0, ship.fuel);

    // Symplectic Euler integration
    ship.vx += ax * dt;
    ship.vy += ay * dt;
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    // Collision detection
    for (const p of planets) {
        const dx = ship.x - p.x;
        const dy = ship.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < p.radius + SHIP_RADIUS) {
            const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
            if (speed < SAFE_LANDING_SPEED) {
                // Land
                ship.landed = p;
                ship.vx = 0;
                ship.vy = 0;
                const angle = Math.atan2(dy, dx);
                ship.x = p.x + Math.cos(angle) * (p.radius + SHIP_RADIUS + 1);
                ship.y = p.y + Math.sin(angle) * (p.radius + SHIP_RADIUS + 1);
            } else {
                // Crash
                ship.crashed = true;
                ship.crashTimer = 1.5;
                ship.vx = 0;
                ship.vy = 0;
            }
            break;
        }
    }
}

// ── Orbit prediction ───────────────────────────────────────
function predictTrajectory(ship, planets) {
    if (ship.landed || ship.crashed) return [];

    const points = [];
    let px = ship.x, py = ship.y;
    let pvx = ship.vx, pvy = ship.vy;

    for (let i = 0; i < PREDICTION_STEPS; i++) {
        const grav = computeGravity(px, py, planets);
        pvx += grav.ax * PREDICTION_DT;
        pvy += grav.ay * PREDICTION_DT;
        px += pvx * PREDICTION_DT;
        py += pvy * PREDICTION_DT;

        // Stop if predicted to hit a planet
        let hit = false;
        for (const p of planets) {
            const dx = px - p.x;
            const dy = py - p.y;
            if (dx * dx + dy * dy < (p.radius + SHIP_RADIUS) * (p.radius + SHIP_RADIUS)) {
                hit = true;
                break;
            }
        }
        points.push({ x: px, y: py, hit });
        if (hit) break;
    }
    return points;
}

// ── Orbit detection ────────────────────────────────────────
function getOrbitInfo(ship, planets) {
    if (ship.landed || ship.crashed) return null;

    let nearest = null;
    let nearestDist = Infinity;

    for (const p of planets) {
        const dx = ship.x - p.x;
        const dy = ship.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = p;
        }
    }

    if (!nearest) return null;

    const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
    const specificEnergy = 0.5 * speed * speed - G * nearest.mass / nearestDist;
    const altitude = nearestDist - nearest.radius;

    return {
        planet: nearest,
        distance: nearestDist,
        altitude: altitude,
        orbiting: specificEnergy < 0,
        speed: speed,
    };
}
