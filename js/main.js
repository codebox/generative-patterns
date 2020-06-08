function init() {
    "use strict";
    let activeLineCount = 0;

    const SEED_COUNT = 10,
        GROWTH_FACTOR = 1,
        BIF_PROB = 0.02,
        MAP_WIDTH = document.getElementById('map').clientWidth,
        MAP_HEIGHT = document.getElementById('map').clientHeight,
        seeds = Array(SEED_COUNT).fill().map(buildSeed);


    function rnd(min, max) {
        return Math.random() * (max - min) + min;
    }

    function grow() {
        seeds.forEach(s => s.grow());
    }

    const map = (() => {
        const mapCtx = document.getElementById('map').getContext('2d'),
            width = MAP_WIDTH,
            height = MAP_HEIGHT;
        mapCtx.canvas.width = width;
        mapCtx.canvas.height = height;

        return {
            width, height,
            clear() {
                mapCtx.clearRect(0, 0, width, height);
            },
            drawLine(line) {
                // console.log(line.p0.x, line.p0.y, line.p1.x, line.p1.y)
                mapCtx.beginPath();
                mapCtx.moveTo(line.p0.x, line.p0.y);
                mapCtx.lineTo(line.p1.x, line.p1.y);
                mapCtx.stroke();
            }
        };
    })();

    function buildLine(p0, angle, growthRate, bifurcationProbability, parent) {
        const line = {
            p0,
            p1: {...p0},
            angle,
            parent,
            active: true,
            split: false,
            grow() {
                this.p1.x += Math.sin(angle) * growthRate * GROWTH_FACTOR;
                this.p1.y += Math.cos(angle) * growthRate * GROWTH_FACTOR;
                this.split = Math.random() < bifurcationProbability;
            },
            clip() {
                this.p1.x -= Math.sin(angle) * growthRate * GROWTH_FACTOR;
                this.p1.y -= Math.cos(angle) * growthRate * GROWTH_FACTOR;
            }
        };
        activeLineCount++;
        line.grow();
        return line;
    }

    function lineOffscreen(line) {
        const x = line.p1.x,
            y = line.p1.y;
        return x < 0 || x > MAP_WIDTH || y < 0 || y > MAP_HEIGHT;
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
    function checkLineCollisions(line) {
        return seeds.some(seed => {
            return seed.lines.some(other => {
                if (other === line || line.parent === other || other.parent === line) {
                    return;
                }
                return lineOffscreen(line) || linesIntersect(line, other);
            })
        })
    }

    function buildSeed(){
        const angle = rnd(0, Math.PI * 2);
        return {
            angle,
            lines: [buildLine({
                x: rnd(0, MAP_WIDTH),
                y: rnd(0, MAP_HEIGHT),
            }, angle, rnd(1,3), BIF_PROB)],
            grow() {
                this.lines.filter(l=>l.active).forEach(line => {
                    line.grow();
                    if (checkLineCollisions(line)) {
                        line.clip();
                        console.log('dead')
                        line.active = false;
                        activeLineCount--;
                        return;
                    }
                    if (line.split) {
                        line.split = false;
                        const newAngle = line.angle + Math.PI/2 * (Math.random() < 0.5 ? 1 : -1);
                        this.lines.push(buildLine({
                            x: line.p1.x,
                            y: line.p1.y,
                        }, newAngle, 1, BIF_PROB, line))
                    }
                });
            }
        };
    }

    function draw() {
        map.clear();
        seeds.forEach(s => s.lines.forEach(map.drawLine))
    }
    function step() {
        grow();
        draw();
    };
    document.getElementById('btn').onclick = () => {
        step();
    }

    function go (){
        const interval = setInterval(() => {
            if (!activeLineCount) {
                console.log('done');
                clearInterval(interval);
            }
            step();
        }, 10)
    }
    go()
}
init();