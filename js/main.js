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

    function buildModel() {
        let activeLineCount = 0,
            seeds;

        function buildLine(config, p0, angle, parent) {
            const growthRate = rnd(config.minGrow, config.maxGrow)
            const line = {
                p0,
                p1: {...p0},
                angle,
                parent,
                active: true,
                split: false,
                steps: 0,
                rnd: rnd(),
                grow() {
                    this.p1.x += Math.sin(angle) * growthRate;
                    this.p1.y += Math.cos(angle) * growthRate;
                    this.steps++;
                    this.split = rnd() < config.pBifurcation;
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

        function buildSeed(config) {
            const angle = rnd(0, Math.PI * 2);
            return {
                angle,
                lines: [buildLine(config, {
                    x: rnd(0, canvas.width),
                    y: rnd(0, canvas.height),
                }, angle)],
                grow() {
                    this.lines.filter(l=>l.active).forEach(line => {
                        line.grow();
                        if (checkLineCollisions(line)) {
                            line.clip();
                            line.active = false;
                            activeLineCount--;
                            return;
                        }
                        if (line.split) {
                            line.split = false;
                            const newAngle = line.angle + Math.PI/2 * (rnd() < 0.5 ? 1 : -1);
                            this.lines.push(buildLine(config, {
                                x: line.p1.x,
                                y: line.p1.y,
                            }, newAngle, line))
                        }
                    });
                }
            };
        }

        const model = {
            generate(config) {
                if (!config) {
                    config = {
                        pBifurcation: rnd(0.05, 0.2),
                        minGrow: rnd(1,2),
                        maxGrow: rnd(3,10),
                    };
                }
                seeds = Array(config.seedCount).fill().map(() => buildSeed(config));
                return config;
            },
            grow() {
                seeds.forEach(s => s.grow());
            },
            forEachLineUntilTrue(fn) {
                (seeds || []).some(seed => {
                    return seed.lines.some(line => {
                        return fn(line);
                    })
                })
            }
        };

        return model;
    }


    function mulberry32(a) {
        // https://stackoverflow.com/a/47593316/138256
        return function() {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    function rnd(a=1, b=0) {
        const min = b && a,
            max = b || a;
        return Math.random() * (max - min) + min;
    }

    const canvas = buildCanvas('map'),
        model = buildModel();


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
        let foundCollision = false;
        model.forEachLineUntilTrue(line2 => {
            if (line1 === line2 || line1.parent === line2 || line2.parent === line1) {
                return;
            }
            return foundCollision = lineOffscreen(line1) || linesIntersect(line1, line2);
        });
        return foundCollision;
    }

    function step() {
        model.grow();

        // TODO check if model has changed, return if it hasn't
        canvas.clear();
        model.forEachLineUntilTrue(line => {
            canvas.drawRect(line, Math.min(50 ,line.steps+1), `hsla(${210 + line.rnd * 40},100%,80%,0.15)`)
        });
        model.forEachLineUntilTrue(canvas.drawLine);
    }

    function runEachFrame(fn) {
        const _ = () => {
            fn();
            requestAnimationFrame(_);
        }
        _();
    }

    function go () {
        canvas.clear();
        model.generate();

        runEachFrame(step);
    }
    document.getElementById('btn').onclick = go

}
init();