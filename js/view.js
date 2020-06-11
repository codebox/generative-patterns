const view = (() => {
    "use strict";
    const elPlayPause = document.getElementById('playPause'),
        elDownload = document.getElementById('download'),
        elContinuous = document.getElementById('continuous'),
        elPencil = document.getElementById('pencil'),
        elSeeds = document.getElementById('recentSeeds'),
        elCanvas = document.getElementById('canvas'),

        NO_OP = () => {},
        MAX_SEEDS = 3,

        STATE_INIT = 1,
        STATE_RUNNING = 2,
        STATE_PAUSED = 3,
        STATE_STOPPED = 4,

        viewModel = {};

    let onStartHandler, onResumeHandler, onPauseHandler, onSeedClickHandler, onPencilClickHandler;

    elPlayPause.onclick = () => {
        let handler, newState;
        if (viewModel.state === STATE_INIT || viewModel.state === STATE_STOPPED) {
            handler = onStartHandler || NO_OP;
            newState = STATE_RUNNING;

        } else if (viewModel.state === STATE_RUNNING) {
            handler = onPauseHandler || NO_OP;
            newState = STATE_PAUSED;

        } else if (viewModel.state === STATE_PAUSED) {
            handler = onResumeHandler || NO_OP;
            newState = STATE_RUNNING;

        } else {
            console.assert(false, 'Unexpected state: ' + viewModel.state);
        }
        viewModel.state = newState;
        updateFromModel();
        handler();
    };

    elContinuous.onclick = () => {
        viewModel.isContinuous = elContinuous.checked;
    };

    elPencil.onclick = () => {
        (onPencilClickHandler || NO_OP)();
    };

    elSeeds.onclick = e => {
        viewModel.state = STATE_RUNNING;
        (onSeedClickHandler || NO_OP)(Number(e.target.innerText));
    };

    elDownload.onclick = () => {
        const link = document.createElement('a');
        link.download = `${viewModel.seeds[0]}.png`;
        link.href = elCanvas.toDataURL();
        link.click();
    };

    function updateFromModel() {
        if (viewModel.state === STATE_RUNNING) {
            elPlayPause.innerText ='Pause';
        } else if (viewModel.state === STATE_PAUSED) {
            elPlayPause.innerText = 'Resume';
        } else {
            elPlayPause.innerText = 'Start';
        }

        elContinuous.checked = viewModel.isContinuous;
        elSeeds.innerHTML = viewModel.seeds.map(seed => `<li>${seed}</li>`).join('');
        elPencil.disabled = elDownload.disabled = (viewModel.state === STATE_INIT || viewModel.state === STATE_RUNNING);
    }

    const canvas = (() => {
        const ctx = elCanvas.getContext('2d');

        function doUpdateDimensions(canvasObj) {
            ctx.canvas.width = canvasObj.width = elCanvas.clientWidth;
            ctx.canvas.height = canvasObj.height = elCanvas.clientHeight;
        }

        let updateDimensions = true;
        const canvas = {
            clear() {
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, elCanvas.width, elCanvas.height);
                if (updateDimensions) {
                    updateDimensions = false;
                    doUpdateDimensions(this);
                }
            },
            drawLine(line, colour) {
                ctx.strokeStyle = colour;
                ctx.lineWidth=1;
                ctx.beginPath();
                ctx.moveTo(line.p0.x, line.p0.y);
                ctx.lineTo(line.p1.x, line.p1.y);
                ctx.stroke();
            },
            drawRect(line, width, colour, withGradient) {
                const xDelta = width * Math.cos(line.angle),
                    yDelta = width * Math.sin(line.angle);

                if (withGradient) {
                    const gradient = ctx.createLinearGradient(line.p0.x - xDelta, line.p0.y + yDelta, line.p0.x + xDelta, line.p0.y - yDelta);
                    gradient.addColorStop(0, 'rgba(255,255,255,0)');
                    gradient.addColorStop(0.5, colour);
                    gradient.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = gradient;
                } else {
                    ctx.fillStyle = colour;
                }
                ctx.beginPath();
                ctx.moveTo(line.p0.x - xDelta, line.p0.y + yDelta);
                ctx.lineTo(line.p1.x - xDelta, line.p1.y + yDelta);
                ctx.lineTo(line.p1.x + xDelta, line.p1.y - yDelta);
                ctx.lineTo(line.p0.x + xDelta, line.p0.y - yDelta);
                ctx.fill();
            },
            drawWithPencil(line, width, colourValues, rnd) {
                const ALPHA_FADEOUT_RATE = 4,
                    ALPHA_RANDOMNESS = 0.1;
                let alpha = 0.4;

                for (let d=1; d<width;d++){
                    ctx.strokeStyle = `hsla(${colourValues.h},${colourValues.s}%,${colourValues.l}%,${alpha + ALPHA_RANDOMNESS * (rnd() - 0.5)})`;
                    ctx.beginPath();
                    ctx.moveTo(line.p0.x - d * Math.cos(line.angle), line.p0.y + d * Math.sin(line.angle));
                    ctx.lineTo(line.p1.x - d * Math.cos(line.angle), line.p1.y + d * Math.sin(line.angle));
                    ctx.stroke();
                    alpha *= (1 - ALPHA_FADEOUT_RATE/width);
                }
            },
            isVisible(x,y) {
                return x >= 0 && x < this.width && y >= 0 && y < this.height;
            }
        };

        window.onresize = () => {
            updateDimensions = true;
            if (viewModel.state !== STATE_RUNNING) {
                const currentImage = elCanvas.toDataURL();
                doUpdateDimensions(canvas);
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                };
                img.src = currentImage;
            }
        };

        return canvas;
    })();

    const viewObj = {
        init() {
            viewModel.state = STATE_INIT;
            viewModel.isContinuous = false;
            viewModel.seeds = [];
            updateFromModel();
        },
        onStart(handler) {
            onStartHandler = handler;
        },
        onResume(handler) {
            onResumeHandler = handler;
        },
        onPause(handler) {
            onPauseHandler = handler;
        },
        onPencil(handler) {
            onPencilClickHandler = handler;
        },
        onSeedClick(handler) {
            onSeedClickHandler = handler;
        },
        addSeed(newSeed) {
            const seedIndex = viewModel.seeds.findIndex(s => s === newSeed);
            if (seedIndex === -1) {
                if (viewModel.seeds.unshift(newSeed) > MAX_SEEDS) {
                    viewModel.seeds.length = MAX_SEEDS;
                }
            } else {
                viewModel.seeds.splice(seedIndex, 1);
                viewModel.seeds.unshift(newSeed);
            }
            updateFromModel();
        },
        setStopped() {
            viewModel.state = STATE_STOPPED;
            updateFromModel();
        },
        isContinuous() {
            return viewModel.isContinuous;
        },
        canvas
    };

    return viewObj;
})();