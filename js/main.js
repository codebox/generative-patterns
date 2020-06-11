function init() {
    "use strict";
    view.init();

    function startNew(seed) {
        const newSeed = generator.startNew(seed);
        view.addSeed(newSeed);
    }

    view.onStart(startNew);

    view.onResume(() => {
        generator.resume();
    });

    view.onPause(() => {
        generator.pause();
    });

    view.onPencil(() => {
        generator.applyPencil();
    });

    view.onSeedClick(seed => {
        startNew(seed);
    });

    generator.onFinishedCurrent(() => {
        if (view.isContinuous()) {
            startNew();
        } else {
            view.setStopped();
        }
    });
}
init();