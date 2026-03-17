// ── Constants ──────────────────────────────────────────────
const G = 30;
const THRUST_POWER = 200;
const ROTATION_SPEED = 3.0;
const FUEL_MAX = 100;
const FUEL_RATE = 4;
const SAFE_LANDING_SPEED = 50;
const SHIP_RADIUS = 8;
const PREDICTION_STEPS = 800;
const PREDICTION_DT = 0.1;

// ── Planets ────────────────────────────────────────────────
function createPlanets() {
    return [
        { name: 'Sol',     x: 0,      y: 0,      radius: 320, mass: 200000, color: '#FFD700', glow: '#FFA500' },
        { name: 'Mercury', x: 2400,   y: 0,      radius: 50,  mass: 3200,   color: '#A0522D', glow: '#8B4513' },
        { name: 'Terra',   x: 0,      y: -5000,  radius: 120, mass: 12000,  color: '#4169E1', glow: '#1E90FF' },
        { name: 'Mars',    x: -8000,  y: 1600,   radius: 85,  mass: 6000,   color: '#CD5C5C', glow: '#B22222' },
        { name: 'Jupiter', x: 6000,   y: 10000,  radius: 220, mass: 80000,  color: '#DAA520', glow: '#B8860B' },
        { name: 'Pluto',   x: -14000, y: -12000, radius: 35,  mass: 1400,   color: '#B0C4DE', glow: '#778899' },
    ];
}

// ── Moons ──────────────────────────────────────────────────
function createMoons(planets) {
    const defs = [
        { name: 'Luna',     parent: 'Terra',   radius: 25, mass: 800, color: '#C0C0C0', glow: '#808080', orbitDist: 350, orbitSpeed: 0.3,  startAngle: 0 },
        { name: 'Phobos',   parent: 'Mars',    radius: 12, mass: 200, color: '#B08060', glow: '#806040', orbitDist: 220, orbitSpeed: 0.6,  startAngle: 0 },
        { name: 'Io',       parent: 'Jupiter', radius: 20, mass: 500, color: '#E8D44D', glow: '#B8A030', orbitDist: 400, orbitSpeed: 0.5,  startAngle: 0 },
        { name: 'Europa',   parent: 'Jupiter', radius: 18, mass: 400, color: '#D4CFC0', glow: '#A09880', orbitDist: 550, orbitSpeed: 0.35, startAngle: 2.1 },
        { name: 'Ganymede', parent: 'Jupiter', radius: 28, mass: 700, color: '#A89080', glow: '#786050', orbitDist: 720, orbitSpeed: 0.22, startAngle: 4.2 },
    ];

    return defs.map(d => {
        const parentPlanet = planets.find(p => p.name === d.parent);
        const angle = d.startAngle;
        return {
            name: d.name,
            x: parentPlanet.x + Math.cos(angle) * d.orbitDist,
            y: parentPlanet.y + Math.sin(angle) * d.orbitDist,
            radius: d.radius,
            mass: d.mass,
            color: d.color,
            glow: d.glow,
            orbit: {
                parent: d.parent,
                distance: d.orbitDist,
                speed: d.orbitSpeed,
                angle: angle,
            },
        };
    });
}

function updateMoons(moons, planets, dt) {
    for (const m of moons) {
        m.orbit.angle += m.orbit.speed * dt;
        const parent = planets.find(p => p.name === m.orbit.parent);
        m.x = parent.x + Math.cos(m.orbit.angle) * m.orbit.distance;
        m.y = parent.y + Math.sin(m.orbit.angle) * m.orbit.distance;
    }
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
function computeGravity(x, y, planets, moons) {
    let ax = 0, ay = 0;
    const bodies = moons ? [...planets, ...moons] : planets;
    for (const p of bodies) {
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
function updateShip(ship, planets, moons, keys, dt) {
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
            ship.vx = Math.cos(ship.angle) * 60;
            ship.vy = Math.sin(ship.angle) * 60;
        }
        return;
    }

    // Gravity
    const grav = computeGravity(ship.x, ship.y, planets, moons);
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

    // Collision detection (planets + moons)
    const allBodies = [...planets, ...moons];
    for (const p of allBodies) {
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
function predictTrajectory(ship, planets, moons) {
    if (ship.landed || ship.crashed) return [];

    const points = [];
    let px = ship.x, py = ship.y;
    let pvx = ship.vx, pvy = ship.vy;
    const allBodies = [...planets, ...moons];

    for (let i = 0; i < PREDICTION_STEPS; i++) {
        const grav = computeGravity(px, py, planets, moons);
        pvx += grav.ax * PREDICTION_DT;
        pvy += grav.ay * PREDICTION_DT;
        px += pvx * PREDICTION_DT;
        py += pvy * PREDICTION_DT;

        // Stop if predicted to hit a body
        let hit = false;
        for (const p of allBodies) {
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
function getOrbitInfo(ship, planets, moons) {
    if (ship.landed || ship.crashed) return null;

    let nearest = null;
    let nearestDist = Infinity;

    const allBodies = [...planets, ...moons];
    for (const p of allBodies) {
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
