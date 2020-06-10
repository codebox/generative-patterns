function init() {
    "use strict";
    view.init();

    view.onStart(() => {
        generator.startNew();
    });

    view.onResume(() => {
        generator.resume();
    });

    view.onPause(() => {
        generator.pause();
    });

    view.onDownload(() => {
        //TODO
    });

    view.onSeedClick(seed => {

    });

    generator.onFinishedCurrent(() => {
        if (view.isContinuous()) {
            generator.startNew();
        } else {
            view.setStopped();
        }
    })

    // view.addSeed(newSeed);
    // view.setStopped();
}
init();