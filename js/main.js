function init() {
    "use strict";

    function buildCanvas(elementId) {
        const element = document.getElementById(elementId),
            ctx = element.getContext('2d');

        let updateDimensions = true;
        const canvas = {
            clear() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (updateDimensions) {
                    ctx.canvas.width = canvas.width = element.clientWidth;
                    ctx.canvas.height = canvas.height = element.clientHeight;
                    updateDimensions = false;
                }
            },
            drawLine(line) {
                ctx.beginPath();
                ctx.moveTo(line.p0.x, line.p0.y);
                ctx.lineTo(line.p1.x, line.p1.y);
                ctx.stroke();
            },
            drawRect(line, width, colour) {
                const xDelta = width * Math.cos(line.angle),
                    yDelta = width * Math.sin(line.angle);
                ctx.fillStyle = colour;
                ctx.beginPath();
                ctx.moveTo(line.p0.x - xDelta, line.p0.y + yDelta);
                ctx.lineTo(line.p1.x - xDelta, line.p1.y + yDelta);
                ctx.lineTo(line.p1.x + xDelta, line.p1.y - yDelta);
                ctx.lineTo(line.p0.x + xDelta, line.p0.y - yDelta);
                ctx.fill();
            },
            isVisible(x,y) {
                return x >= 0 && x < canvas.width && y >= 0 && y < canvas.height;
            }
        };

        window.onresize = () => updateDimensions = true;

        return canvas;
    }

    function buildModel(config) {
        let activeLineCount = 0,
            seeds;

        function buildLine(p0, angle, parent) {
            const growthRate = rnd(config.minGrow, config.maxGrow)
            const line = {
                p0,
                p1: {...p0},
                angle,
                generation: parent ? parent.generation + 1 : 0,
                parent,
                active: true,
                split: false,
                expired: false,
                steps: 0,
                rnd: rnd(),
                grow() {
                    this.p1.x += Math.sin(angle) * growthRate;
                    this.p1.y += Math.cos(angle) * growthRate;
                    this.steps++;
                    this.split = rnd() < config.pBifurcation;
                    if (rnd() < this.generation * config.expiryThreshold) {
                        this.expired = true;
                    }
                },
                clip() {
                    this.p1.x -= Math.sin(angle) * growthRate;
                    this.p1.y -= Math.cos(angle) * growthRate;
                }
            };
            activeLineCount++;
            line.grow();
            return line;
        }

        function buildSeed() {
            const angle = rnd(0, Math.PI * 2);
            return {
                angle,
                lines: [buildLine({
                    x: rnd(0, canvas.width),
                    y: rnd(0, canvas.height),
                }, angle)],
                grow() {
                    this.lines.filter(l=>l.active).forEach(line => {
                        line.grow();
                        if (line.expired) {
                            line.active = false;
                            activeLineCount--;
                            return;
                        }
                        if (checkLineCollisions(line)) {
                            line.clip();
                            line.active = false;
                            activeLineCount--;
                            return;
                        }
                        if (line.split) {
                            line.split = false;
                            const newAngle = line.angle + Math.PI/2 * (rnd() < 0.5 ? 1 : -1);
                            this.lines.push(buildLine({
                                x: line.p1.x,
                                y: line.p1.y,
                            }, newAngle, line))
                        }
                    });
                }
            };
        }

        const model = {
            generate() {
                seeds = Array(config.seedCount).fill().map(buildSeed);
            },
            grow() {
                seeds.forEach(s => s.grow());
            },
            forEachLineUntilTrue(fn) {
                (seeds || []).some(seed => {
                    return seed.lines.some(line => {
                        return fn(line, config);
                    })
                })
            },
            isActive() {
                return activeLineCount > 0;
            }
        };

        return model;
    }


    function randomFromSeed(seed = Date.now()) {
        // https://stackoverflow.com/a/47593316/138256
        function mulberry32() {
            var t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }

        console.log('seed',seed)
        return function(a=1, b=0) {
            const min = b && a,
                max = b || a;
            return mulberry32() * (max - min) + min;
        }
    }

    let rnd = randomFromSeed();
    const canvas = buildCanvas('map');
    let model;

    function lineOffscreen(line) {
        return !canvas.isVisible(line.p1.x, line.p1.y);
    }

    function orientation(p, q, r) {
        const val = ((q.y - p.y) * (r.x - q.x)) - ((q.x - p.x) * (r.y - q.y))
        if (val > 0) {
            return 1;
        } else if (val < 0) {
            return 2;
        }
        return 0;
    }
    function onSegment(p, q, r){
        if ( (q.x <= Math.max(p.x, r.x)) && (q.x >= Math.min(p.x, r.x)) && (q.y <= Math.max(p.y, r.y)) && (q.y >= Math.min(p.y, r.y))){
            return true;
        }
        return false;
    }

    function linesIntersect(l1, l2) {
        const p1 = l1.p0, q1 = l1.p1, p2 = l2.p0, q2 = l2.p1;
        const o1 = orientation(p1, q1, p2),
            o2 = orientation(p1, q1, q2),
            o3 = orientation(p2, q2, p1),
            o4 = orientation(p2, q2, q1);

        if ((o1 != o2) && (o3 != o4)) {
            return true;
        }

        if ((o1 == 0) && onSegment(p1, p2, q1)) {
            return true;
        }

        if ((o2 == 0) && onSegment(p1, q2, q1)) {
            return true;
        }

        if ((o3 == 0) && onSegment(p2, p1, q2)) {
            return true;
        }

        if ((o4 == 0) && onSegment(p2, q1, q2)) {
            return true;
        }

        return false;
    }
    function checkLineCollisions(line1) {
        if (lineOffscreen(line1)) {
            return true;
        }
        let foundCollision = false;
        model.forEachLineUntilTrue(line2 => {
            if (line1 === line2 || line1.parent === line2 || line2.parent === line1) {
                return;
            }
            return foundCollision = linesIntersect(line1, line2);
        });
        return foundCollision;
    }

    function step() {
        model.grow();

        if (model.isActive()) {
            canvas.clear();
            model.forEachLineUntilTrue((line, config) => {
                canvas.drawRect(line, Math.min(config.maxRectWidth, line.steps), `hsla(${(config.rectBaseHue + (line.rnd - 0.5) * config.rectHueVariation) % 360},${config.rectSaturation}%,${config.rectLightness}%,${config.rectAlpha})`);
            });
            model.forEachLineUntilTrue(canvas.drawLine);
            return true;
        }
    }

    function buildRandomConfig() {
        return {
            seedCount: Math.round(rnd(1, 10)),
            pBifurcation: rnd(0.05, 0.1),
            minGrow: rnd(1,2),
            maxGrow: rnd(3,10),
            maxRectWidth: rnd(0,200),
            rectBaseHue: rnd(360),
            rectSaturation: rnd(20,100),
            rectHueVariation: rnd(100),
            rectAlpha: rnd(0.5,1),
            rectLightness: rnd(20,100),
            expiryThreshold: rnd(0.001)
        };
    }

    function newSession() {
        let running = false;

        const session = {
            start() {
                if (running) {
                    return;
                }
                running = true;
                rnd = randomFromSeed();
                model = buildModel(buildRandomConfig());
                canvas.clear();
                model.generate();

                function run() {
                    if (!running) {
                        return;
                    }

                    const isActive = step();

                    if (isActive) {
                        requestAnimationFrame(run);

                    } else {
                        session.stop();
                        setTimeout(session.start, 3000);
                    }
                }
                run();
            },
            stop() {
                if (!running) {
                    return;
                }
                running = false;
            },
            isRunning() {
                return running;
            }
        };
        return session;
    }

    const btn = document.getElementById('btn');

    let session = newSession()

    btn.onclick = () => {
        if (session.isRunning()) {
            session.stop();
            btn.innerText = 'Go';
        } else {
            session.start();
            btn.innerText = 'Stop';
        }
    }

}
init();