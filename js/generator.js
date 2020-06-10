const generator = (() => {
    "use strict";

    function buildModel(config, rnd, collisionDetector) {
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
                        if (collisionDetector.checkForCollisions(line, model.forEachLineUntilTrue)) {
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


    function randomFromSeed(seed) {
        // https://stackoverflow.com/a/47593316/138256
        function mulberry32() {
            var t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }

        return function(a=1, b=0) {
            const min = b && a,
                max = b || a;
            return mulberry32() * (max - min) + min;
        }
    }

    function buildCollisionDetector(canvas) {
        function lineOffscreen(line) {
            return !canvas.isVisible(line.p1.x, line.p1.y);
        }

        function orientation(p, q, r) {
            const val = ((q.y - p.y) * (r.x - q.x)) - ((q.x - p.x) * (r.y - q.y));
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

        return {
            checkForCollisions(line1, forEachLineUntilTrue) {
                if (lineOffscreen(line1)) {
                    return true;
                }
                let foundCollision = false;
                forEachLineUntilTrue(line2 => {
                    if (line1 === line2 || line1.parent === line2 || line2.parent === line1) {
                        return;
                    }
                    return foundCollision = linesIntersect(line1, line2);
                });
                return foundCollision;
            }
        };
    }

    function buildRandomConfig(rnd) {
        const useGradients = rnd() > 0.3;
        return {
            seedCount: Math.round(rnd(1, 10)),
            pBifurcation: rnd(0.05, 0.1),
            minGrow: rnd(1,2),
            maxGrow: rnd(3,10),
            maxRectWidth: rnd(0,100),
            rectBaseHue: rnd(360),
            rectSaturation: rnd(20,100),
            rectHueVariation: rnd(100),
            rectAlpha: useGradients ? rnd(0.4,0.8) : rnd(0.1,0.4),
            rectLightness: rnd(20,70),
            expiryThreshold: rnd(0.001),
            lineDarkness: rnd(),
            useGradients
        };
    }


    function createNewRender(seed, onFinished) {
        function update() {
            model.grow();

            if (model.isActive()) {
                view.canvas.clear();
                model.forEachLineUntilTrue((line, config) => {
                    view.canvas.drawRect(line, Math.min(config.maxRectWidth, line.steps), `hsla(${(config.rectBaseHue + (line.rnd - 0.5) * config.rectHueVariation) % 360},${config.rectSaturation}%,${config.rectLightness}%,${config.rectAlpha})`, config.useGradients);
                });
                model.forEachLineUntilTrue((line, config) => {
                    const lineColourValue = Math.round(config.lineDarkness * 100),
                        lineColour = `rgb(${lineColourValue},${lineColourValue},${lineColourValue})`;
                    view.canvas.drawLine(line, lineColour)
                });
                return false;
            }
            return true;
        }

        let model, rnd, config, stopRequested, collisionDetector;

        return {
            init(rnd) {
                stopRequested = false;
                rnd = randomFromSeed(seed);
                config = buildRandomConfig(rnd);
                collisionDetector = buildCollisionDetector(view.canvas);
                model = buildModel(config, rnd, collisionDetector);
                view.canvas.clear();
                model.generate();
            },
            start() {
                function doUpdate() {
                    const isComplete = update();

                    if (stopRequested) {
                        stopRequested = false;

                    } else if (isComplete) {
                        onFinished();

                    } else {
                        requestAnimationFrame(doUpdate);
                    }
                }
                doUpdate();
            },
            stop() {
                stopRequested = true;
            }
        };
    }

    let render, onFinishedCurrentHandler = () => {};

    return {
        onFinishedCurrent(handler) {
            onFinishedCurrentHandler = handler;
        },
        startNew(seed=Date.now()) {
            if (render) {
                render.stop();
            }
            render = createNewRender(seed, onFinishedCurrentHandler);
            render.init();
            render.start();
            return seed;
        },
        resume() {
            render.start();
        },
        pause() {
            render.stop();
        }
    };

})();
