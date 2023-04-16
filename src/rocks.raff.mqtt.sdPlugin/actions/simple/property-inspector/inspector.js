/// <reference path="../../../libs/js/property-inspector.js" />
/// <reference path="../../../libs/js/utils.js" />

$PI.onConnected((jsn) => {
    const formGlobal = document.querySelector('#property-inspector-global');
    const formGlobalSave = document.querySelector('#save');
    const form = document.querySelector('#property-inspector');
    const {actionInfo, appInfo, connection, messageType, port, uuid} = jsn;
    const {payload, context} = actionInfo;
    const {settings} = payload;


    Utils.setFormValue(settings, form);

    $PI.getGlobalSettings();

    /*formGlobal.addEventListener(
        'input',
        Utils.debounce(150, () => {
            const value = Utils.getFormValue(formGlobal);
            console.log(value);
            $PI.setGlobalSettings(value);
        })
    );
    */

    formGlobalSave.addEventListener('click', () => {
        const value = Utils.getFormValue(formGlobal);
        console.log(value);
        $PI.setGlobalSettings(value);
    });

    form.addEventListener(
        'input',
        Utils.debounce(150, () => {
            const value = Utils.getFormValue(form);
            console.log(value);
            $PI.setSettings(value);
        })
    );

});

$PI.onDidReceiveSettings('rocks.raff.mqtt.simple.action', ({payload}) => {
    console.log('onDidReceiveSettings', 'rocks.raff.mqtt.simple.action', payload);
});

$PI.onDidReceiveGlobalSettings(({payload}) => {
    console.log('onDidReceiveGlobalSettings', payload);
    const formGlobal = document.querySelector('#property-inspector-global');
    Utils.setFormValue(payload.settings, formGlobal);
});

$PI.onSendToPropertyInspector('rocks.raff.mqtt.simple.action', ({payload}) => {
    console.log(payload);
});
