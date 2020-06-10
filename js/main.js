function init() {
    "use strict";
    view.init();

    function startNew() {
        const newSeed = generator.startNew();
        view.addSeed(newSeed);
    }

    view.onStart(startNew);

    view.onResume(() => {
        generator.resume();
    });

    view.onPause(() => {
        generator.pause();
    });

    view.onSeedClick(seed => {

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