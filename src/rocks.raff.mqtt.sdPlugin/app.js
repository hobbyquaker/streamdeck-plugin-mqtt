/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />

const globalSettings = {};
const simpleSettings = {};
const toggleSettings = {};

const toggleState = {};
const titleState = {};
const imageState = {};

const subscriptions = {};

const actionSimple = new Action('rocks.raff.mqtt.simple.action');
const actionToggle = new Action('rocks.raff.mqtt.toggle.action');

$SD.onDidReceiveSettings('rocks.raff.mqtt.simple.action', ({context, payload}) => {
    console.log('onDidReceiveSettings', 'rocks.raff.mqtt.simple.action', payload)
    simpleSettings[context] = {
       ...payload.settings
    };
    setTimeout(() => {
        subscribe(context, 'title', simpleSettings[context]?.topicTitle, simpleSettings[context]?.path);
        subscribe(context, 'image', simpleSettings[context]?.topicImage);
    }, 1000);
});

$SD.onDidReceiveSettings('rocks.raff.mqtt.toggle.action', ({context, payload}) => {
    console.log('onDidReceiveSettings', 'rocks.raff.mqtt.toggle.action', payload)
    toggleSettings[context] = {
        ...payload.settings
    }
    setTimeout(() => {
        subscribe(context, 'state', toggleSettings[context]?.subscribeTopic, toggleSettings[context]?.subscribePath);
    }, 1000);
});

let recCount = 0;

$SD.onDidReceiveGlobalSettings(({payload}) => {
    //console.log('onDidReceiveGlobalSettings', payload.settings);
    globalSettings.host = payload.settings.host;
    globalSettings.port = payload.settings.port;
    globalSettings.clientId = payload.settings.clientId;
    globalSettings.tls = payload.settings.tls;
    globalSettings.user = payload.settings.user;
    globalSettings.password = payload.settings.password;
    setTimeout(connect, (recCount++) * 200);
})

actionSimple.onKeyDown(({ action, context, device, event, payload }) => {
    if (connected && simpleSettings[context].topic) {
        console.log(context, 'publish', simpleSettings[context].topic, simpleSettings[context].payload);
        const message = new Paho.MQTT.Message(simpleSettings[context].payload || '');
        message.destinationName = simpleSettings[context].topic;
        message.retained = simpleSettings[context].retain === 'true';
        client.send(message);
    } else {
        $SD.showAlert(context);
        if (!connected) {
            connect();
        }
    }
});

actionToggle.onKeyDown(({ action, context, device, event }) => {
    //console.log('actionToggle onKeyDown', context, toggleState[context]);
    if (toggleSettings[context] && toggleSettings[context].topic) {
        const payload = toggleState[context] ? toggleSettings[context].payloadOff : toggleSettings[context].payloadOn;
        console.log(context, 'publish', toggleSettings[context].topic, payload);
        const message = new Paho.MQTT.Message(payload || '');
        message.destinationName = toggleSettings[context].topic;
        message.retained = toggleSettings[context].retain === 'true';
        client.send(message);
        toggleState[context] = toggleState[context] ? 0 : 1;
        $SD.setState(context, toggleState[context]);
    } else {
        $SD.showAlert(context);
        if (!connected) {
            connect();
        }
    }
});

actionToggle.onKeyUp(({context}) => {
    $SD.setState(context, toggleState[context]);
});

actionSimple.onWillAppear(({context}) => {
    //console.log('actionSimple.onWillAppear', context);
    $SD.getGlobalSettings();
    $SD.getSettings(context);
    if (typeof titleState[context] !== 'undefined') {
        $SD.setTitle(context, titleState[context]);
    }
    if (typeof imageState[context] !== 'undefined') {
        $SD.setImage(context, imageState[context]);
    }
    if (simpleSettings[context]) {
        subscribe(context, 'title', simpleSettings[context]?.topicTitle, simpleSettings[context]?.path);
        subscribe(context, 'image', simpleSettings[context]?.topicImage);
    } else {
        setTimeout(() => {
            subscribe(context, 'title', simpleSettings[context]?.topicTitle, simpleSettings[context]?.path);
            subscribe(context, 'image', simpleSettings[context]?.topicImage);
        }, 1000)
    }
});

actionSimple.onWillDisappear(({context}) => {
    unsubscribe(context, 'title', simpleSettings[context]?.topicTitle, simpleSettings[context]?.path);
    unsubscribe(context, 'image', simpleSettings[context]?.topicImage);
});

actionToggle.onWillAppear(({context}) => {
    //console.log('actionToggle.onWillAppear', context);
    $SD.getGlobalSettings();
    $SD.getSettings(context);
    $SD.setState(context, toggleState[context] || 0);
    if (toggleSettings[context]) {
        subscribe(context, 'state', toggleSettings[context]?.subscribeTopic, toggleSettings[context]?.subscribePath);
    } else {
        setTimeout(() => {
            subscribe(context, 'state', toggleSettings[context]?.subscribeTopic, toggleSettings[context]?.subscribePath);
        }, 1000)
    }
    //subscribe(context, 'title', toggleSettings.topicTitle, toggleSettings.path);
});

actionToggle.onWillDisappear(({context}) => {
    unsubscribe(context, 'title', toggleSettings[context].subscribeTopic);
});

function subscribe(context, type, topic, path) {
    if (typeof topic === 'string' && topic) {
        console.log(context, 'subscribe', type, topic);
        if (!subscriptions[topic]) {
            subscriptions[topic] = [{context, type, path}];
            if (connected) {
                console.log('subscribe', topic);
                client.subscribe(topic);
            }
        } else {
            let index = -1;
            subscriptions[topic].forEach((obj, i) => {
                if (obj.context === context && obj.type === type) {
                    index = i;
                }
            });
            if (index !== -1) {
                subscriptions[topic].splice(index, 1);
            }
            subscriptions[topic].push({context, type, path});

        }
        console.log('subscriptions', subscriptions);
    }
}

function unsubscribe(context, type, topic) {
    return;
    if (connected && typeof topic === 'string' && topic) {
        console.log(context, 'unsubscribe', topic);
        if (subscriptions[topic]) {
            let index = -1;
            subscriptions[topic].forEach((obj, i) => {
                if (obj.context === context && obj.type === type) {
                    index = i;
                }
            });
            if (index !== -1) {
                subscriptions[topic].splice(index, 1);
            }
            if (subscriptions[topic].length === 0) {
                console.log('unsubscribe', topic);
                delete subscriptions[topic];
                client.unsubscribe(topic);
            }
        }
        console.log('subscriptions', subscriptions);
    }
}

let client;
let connected = false;

function getProperty(payload, path) {
    const p = payload;
    //console.log('getProperty', payload, path);
    if (path) {
        try {
            payload = JSON.parse(payload);
            const props = path.split('.');
            props.forEach(prop => {
                payload = payload[prop];
            });
            return payload;
        } catch (error) {
            //console.log(error);
        }
    }
    return p;
}

let currentConnection;

function connect() {
    if (connected && currentConnection === globalSettings.host + ':' + globalSettings.port) return;
    if (connected && client && typeof client.disconnect === 'function') {
        console.log('disconnect');
        client.disconnect();
    }
    const clientId = globalSettings.clientId || 'mqtt.sdPlugin.' + Math.floor(Math.random() * 0xffffff).toString(16).padEnd(6, "0");
    client = new Paho.MQTT.Client(globalSettings.host, Number(globalSettings.port), clientId);
    console.log('connect', globalSettings.host, globalSettings.port, clientId);
    client.connect({
        onSuccess: () =>
        {
            console.log('connect success');
            connected = true;
            currentConnection = globalSettings.host + ':' + globalSettings.port;

            client.onMessageArrived = (message) => {
                const topic = message.destinationName;
                let payload = message.payloadString;
                console.log('onMessageArrived', topic, payload);

                if (subscriptions[topic]) {
                    subscriptions[topic].forEach(({context, type, path}) => {
                        console.log(context, 'dispatching message', type, path);

                        switch (type) {
                            case 'title':
                                payload = getProperty(payload, path);
                                console.log('setTitle', context, payload);
                                titleState[context] = payload.replace(/\\n/g, "\n")
                                $SD.setTitle(context, titleState[context]);
                                break;
                            case 'state':
                                payload = getProperty(payload, path);
                                const state = String(payload) === toggleSettings[context].payloadOn ? 1 : 0;
                                $SD.setState(context, state);
                                toggleState[context] = state;
                                console.log('setState', context, state);
                                break;
                            case 'image':
                                if (payload.startsWith('data:image/')) {
                                    $SD.setImage(context, payload);
                                    imageState[context] = payload;
                                    console.log('setImage', context);
                                } else {
                                    console.log('invalid image received');
                                }
                                break;
                            default:
                                console.log('type', type, 'not implemented');
                        }
                    });
                }
            };

            Object.keys(subscriptions).forEach(topic => {
                subscriptions[topic].forEach(({context, type, path}) => {
                    subscribe(context, type, topic, path);
                });
            });
            //$SD.sendToPropertyInspector('connected', true);
        },
        onFailure: () =>
        {
            console.log('connect failure');
            connected = false;
            //$SD.sendToPropertyInspector('connected', false);
        },
        timeout: 5,
        useSSL: globalSettings.tls === "true",
        userName: globalSettings.user || '',
        password: globalSettings.password || ''
    });
}
