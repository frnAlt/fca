"use strict";

const EventEmitter = require("events");

/**
 * Creates a blank FcaContext object.
 * @returns {object}
 */
function createDefaultContext() {
    return {
        userID: "",
        fbid: "",
        cookieString: "",
        jar: null,
        clientID: undefined,
        appID: undefined,
        globalOptions: {},
        options: {},
        loggedIn: false,
        access_token: "NONE",
        clientMutationId: 0,
        mqttClient: undefined,
        lastSeqId: null,
        syncToken: undefined,
        mqttEndpoint: undefined,
        wsReqNumber: 0,
        wsTaskNumber: 0,
        reqCallbacks: {},
        callback_Task: {},
        region: "PRN",
        firstListen: true,
        _emitter: new EventEmitter(),
        fb_dtsg: undefined,
        jazoest: undefined,
        lsd: undefined,
        ttstamp: undefined,
        api: null,
    };
}

/**
 * Creates an initialized FCA state object from an existing ctx.
 * @param {object} [ctx] - Existing context to extend.
 * @returns {object}
 */
function createFcaState(ctx = {}) {
    return Object.assign(createDefaultContext(), ctx);
}

/**
 * Builds a minimal api facade from an existing ctx. Allows attaching methods.
 * @param {object} ctx - FcaContext object.
 * @returns {object}
 */
function createApiFacade(ctx = {}) {
    const facade = {
        ctx,
        getCurrentUserID() {
            return ctx.userID || ctx.fbid || "";
        },
        getAppState() {
            if (!ctx.jar) return [];
            try {
                const appState = [];
                const cookies = ctx.jar.getCookiesSync("https://www.facebook.com");
                for (const c of cookies) {
                    appState.push({
                        key: c.key,
                        value: c.value,
                        domain: c.domain,
                        path: c.path,
                        hostOnly: c.hostOnly,
                        creation: c.creation,
                        lastAccessed: c.lastAccessed,
                    });
                }
                return appState;
            } catch {
                return [];
            }
        },
        setOptions(opts) {
            Object.assign(ctx.globalOptions || {}, opts);
        },
    };
    return facade;
}

/**
 * Creates a minimal request helper (for API compat). Real HTTP is done via axios.js.
 * @param {object} ctx - FcaContext
 * @returns {object}
 */
function createRequestHelper(ctx = {}) {
    return {
        get(url, qs, options) {
            const network = require("../utils/axios");
            return network.get(url, ctx.jar, qs, options || ctx.globalOptions, ctx);
        },
        post(url, form, options) {
            const network = require("../utils/axios");
            return network.post(url, ctx.jar, form, options || ctx.globalOptions, ctx);
        },
        postFormData(url, form, options) {
            const network = require("../utils/axios");
            return network.postFormData(url, ctx.jar, form, options || ctx.globalOptions, ctx);
        },
        ctx,
    };
}

module.exports = {
    createDefaultContext,
    createFcaState,
    createApiFacade,
    createRequestHelper,
};
