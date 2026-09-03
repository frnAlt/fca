"use strict";

const EventEmitter = require('events');
const utils = require('../../utils');
const SimpleCache = require('../../utils/cache');
const { globalValidator } = require('../../utils/validation');
const { AntiSuspension } = require('../../utils/antiSuspension');

/**
 * Builds the core API context and default functions after successful login.
 *
 * @param {string} html The HTML body from the initial Facebook page.
 * @param {object} jar The cookie jar.
 * @param {Array<object>} netData Network data extracted from the HTML.
 * @param {object} globalOptions The global options object.
 * @param {function} fbLinkFunc A function to generate Facebook links.
 * @param {string} errorRetrievingMsg The error message for retrieving user ID.
 * @returns {Array<object>} An array containing [ctx, defaultFuncs, {}].
 */
async function buildAPI(html, jar, netData, globalOptions, fbLinkFunc, errorRetrievingMsg) {
    let userID;
    const url = typeof fbLinkFunc === 'function' ? fbLinkFunc() : "https://www.facebook.com/";
    let cookies = (jar.getCookiesSync ? jar.getCookiesSync(url) : []) || [];
    let primaryProfile = cookies.find((val) => val.cookieString().startsWith("c_user="));
    let secondaryProfile = cookies.find((val) => val.cookieString().startsWith("i_user="));

    if (!primaryProfile && !secondaryProfile && typeof jar.getCookiesSync === 'function') {
        const altCookies = [
            ...jar.getCookiesSync("https://www.facebook.com/"),
            ...jar.getCookiesSync("https://facebook.com/"),
            ...jar.getCookiesSync("https://m.facebook.com/"),
            ...jar.getCookiesSync("https://mbasic.facebook.com/")
        ];
        primaryProfile = altCookies.find((val) => val.cookieString().startsWith("c_user="));
        secondaryProfile = altCookies.find((val) => val.cookieString().startsWith("i_user="));
    }

    if (!primaryProfile && !secondaryProfile && typeof jar.toJSON === 'function') {
        const allCookies = jar.toJSON().cookies || [];
        const cUser = allCookies.find(c => c.key === "c_user" || c.name === "c_user");
        const iUser = allCookies.find(c => c.key === "i_user" || c.name === "i_user");
        if (cUser) primaryProfile = { cookieString: () => `c_user=${cUser.value}` };
        if (iUser) secondaryProfile = { cookieString: () => `i_user=${iUser.value}` };
    }

    if (!primaryProfile && !secondaryProfile && typeof html === 'string') {
        const matchUser = html.match(/"USER_ID":"(\d+)"/) || html.match(/c_user=(\d+)/) || html.match(/"actorID":"(\d+)"/) || html.match(/ACCOUNT_ID":"(\d+)"/);
        if (matchUser && matchUser[1]) {
            primaryProfile = { cookieString: () => `c_user=${matchUser[1]}` };
        }
    }

    if (!primaryProfile && !secondaryProfile) {
        throw new Error(errorRetrievingMsg);
    }
    userID = secondaryProfile?.cookieString().split("=")[1] || primaryProfile.cookieString().split("=")[1];

    const findConfig = (key) => {
        for (const scriptData of netData) {
            if (scriptData.require) {
                for (const req of scriptData.require) {
                    if (Array.isArray(req) && req[0] === key && req[2]) {
                        return req[2];
                    }
                    if (Array.isArray(req) && req[3] && req[3][0] && req[3][0].__bbox && req[3][0].__bbox.define) {
                        for (const def of req[3][0].__bbox.define) {
                            if (Array.isArray(def) && def[0].endsWith(key) && def[2]) {
                                return def[2];
                            }
                        }
                    }
                }
            }
        }
        return null;
    };

    const dtsgData = findConfig("DTSGInitialData") || findConfig("DTSGInitData");
    let dtsg = dtsgData?.token;
    if (!dtsg && typeof html === "string") {
        dtsg = utils.getFrom(html, '"DTSGInitialData",[],{"token":"', '"')
            || utils.getFrom(html, '"token":"', '"')
            || (html.match(/name="fb_dtsg"\s+value="([^"]+)"/)?.[1])
            || (html.match(/"fb_dtsg"\s*:\s*"([^"]+)"/)?.[1])
            || "";
    }
    dtsg = dtsg || "";
    
    const lsdData = findConfig("LSD");
    let lsd = lsdData?.token;
    if (!lsd && typeof html === "string") {
        lsd = utils.getFrom(html, '"LSD",[],{"token":"', '"')
            || (html.match(/name="lsd"\s+value="([^"]+)"/)?.[1])
            || "";
    }
    lsd = lsd || "";
    
    const jazoest = dtsg
        ? `2${Array.from(dtsg).reduce((a, b) => a + b.charCodeAt(0), 0)}`
        : "2";

    const dtsgResult = { 
        fb_dtsg: dtsg, 
        jazoest: jazoest,
        lsd: lsd
    };

    const clientIDData = findConfig("MqttWebDeviceID");
    const clientID = clientIDData ? clientIDData.clientID : undefined;

    const mqttConfigData = findConfig("MqttWebConfig");
    const mqttAppID = mqttConfigData ? mqttConfigData.appID : undefined;

    const currentUserData = findConfig("CurrentUserInitialData");
    const userAppID = currentUserData ? currentUserData.APP_ID : undefined;

    let primaryAppID = userAppID || mqttAppID;

    let mqttEndpoint = mqttConfigData ? mqttConfigData.endpoint : undefined;

    let region = mqttEndpoint ? new URL(mqttEndpoint).searchParams.get("region")?.toUpperCase() : undefined;
    const irisSeqIDMatch = html.match(/irisSeqID:"(.+?)"/)
        || html.match(/"irisSeqID"\s*:\s*"([^"]+)"/)
        || html.match(/"sync_sequence_id"\s*:\s*"([^"]+)"/)
        || html.match(/"sequence_id"\s*:\s*"([^"]+)"/)
        || html.match(/\["irisSeqID",\s*\[\],\s*\{"seqID"\s*:\s*"([^"]+)"\}/);
    const irisSeqID = irisSeqIDMatch ? (irisSeqIDMatch[1] || irisSeqIDMatch[2]) : null;

    // Extract Facebook client-state tokens that are embedded in every page load.
    // Real browsers include these in every subsequent request to prove the request
    // originated from a genuine page load. Missing them is a strong bot signal.
    const spinRMatch = html.match(/"__spin_r"\s*:\s*(\d+)/);
    const spinTMatch = html.match(/"__spin_t"\s*:\s*(\d+)/);
    const __spin_r = spinRMatch ? parseInt(spinRMatch[1], 10) : null;
    const __spin_t = spinTMatch ? parseInt(spinTMatch[1], 10) : null;
    const __spin_b = 'trunk';

    if (globalOptions.bypassRegion && mqttEndpoint) {
        const currentEndpoint = new URL(mqttEndpoint);
        currentEndpoint.searchParams.set('region', globalOptions.bypassRegion.toLowerCase());
        mqttEndpoint = currentEndpoint.toString();
        region = globalOptions.bypassRegion.toUpperCase();
    }

    const emitter = new EventEmitter();
    emitter.setMaxListeners(50);
    const antiSuspension = new AntiSuspension();

    // Pre-compute ttstamp so it is present from the very first request.
    // tokenRefresh.js sets this field on every refresh — initialising it here
    // keeps ctx consistent and prevents undefined reads before the first refresh.
    const ttstamp = dtsgResult.fb_dtsg
        ? "2" + Array.from(dtsgResult.fb_dtsg).map(c => c.charCodeAt(0)).join("")
        : "2";

    const ctx = {
        userID,
        jar,
        clientID,
        appID: primaryAppID, 
        mqttAppID: mqttAppID, 
        userAppID: userAppID, 
        globalOptions,
        loggedIn: true,
        access_token: "NONE",
        clientMutationId: 0,
        mqttClient: undefined,
        lastSeqId: irisSeqID,
        syncToken: undefined,
        mqttEndpoint,
        wsReqNumber: 0,
        wsTaskNumber: 0,
        reqCallbacks: {},
        callback_Task: {},
        region,
        firstListen: true,
        cache: new SimpleCache(),
        validator: globalValidator,
        antiSuspension,
        _emitter: emitter,
        ttstamp,
        // Client-state spin tokens extracted from the page HTML.
        // These are included in every subsequent request body to prove the
        // request originated from a real page load (not a standalone script).
        __spin_r,
        __spin_t,
        __spin_b,
        ...dtsgResult,
    };
    const defaultFuncs = utils.makeDefaults(html, userID, ctx);

    return [ctx, defaultFuncs, {}];
}

module.exports = buildAPI;
