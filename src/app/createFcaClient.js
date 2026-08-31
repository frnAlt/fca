"use strict";

const { DomainsManager } = require("../domains");
const { MessagesDomain } = require("../domains/messages");
const { ThreadsDomain } = require("../domains/threads");
const { UsersDomain } = require("../domains/users");
const { AccountDomain } = require("../domains/account");
const { RealtimeDomain } = require("../domains/realtime");
const { CapabilityResolver } = require("../utils/CapabilityResolver");
const { MqttRealtimeManager } = require("../utils/MqttRealtimeManager");

function compactNamespace(ns) {
    if (!ns || typeof ns !== "object") return ns;
    const out = {};
    for (const [k, v] of Object.entries(ns)) {
        if (typeof v === "function") out[k] = v;
    }
    return out;
}

function buildFallbackMessages(api) {
    return {
        send: api.sendMessage?.bind(api),
        edit: api.editMessage?.bind(api),
        unsend: api.unsendMessage?.bind(api),
        delete: api.deleteMessage?.bind(api),
        setReaction: api.setMessageReaction?.bind(api),
        sendTyping: api.sendTypingIndicator?.bind(api),
        markRead: api.markAsRead?.bind(api),
        markDelivered: api.markAsDelivered?.bind(api),
        markSeen: api.markAsSeen?.bind(api),
        markReadAll: api.markAsReadAll?.bind(api),
        upload: api.uploadAttachment?.bind(api),
        forward: api.forwardAttachment?.bind(api),
        forwardMessage: api.forwardMessage?.bind(api),
        shareContact: api.shareContact?.bind(api),
        changeColor: api.changeThreadColor?.bind(api),
        changeEmoji: api.changeThreadEmoji?.bind(api),
        getMessage: api.getMessage?.bind(api),
        getEmojiUrl: api.getEmojiUrl?.bind(api),
        resolvePhotoUrl: api.resolvePhotoUrl?.bind(api),
        getThreadColors: api.getThreadColors?.bind(api),
    };
}

function buildFallbackThreads(api) {
    return {
        getInfo: api.getThreadInfo?.bind(api),
        getList: api.getThreadList?.bind(api),
        getHistory: api.getThreadHistory?.bind(api),
        getPictures: api.getThreadPictures?.bind(api),
        getThemePictures: api.getThemePictures?.bind(api),
        search: api.searchForThread?.bind(api),
        createGroup: api.createNewGroup?.bind(api),
        addUser: api.addUserToGroup?.bind(api),
        removeUser: api.removeUserFromGroup?.bind(api),
        changeAdmin: api.changeAdminStatus?.bind(api),
        changeImage: api.changeGroupImage?.bind(api),
        changeNickname: (api.setNickname || api.nickname || api.changeNickname)?.bind(api),
        setTitle: api.setTitle?.bind(api),
        createPoll: api.createPoll?.bind(api),
        createThemeAI: api.createAITheme?.bind(api),
        delete: api.deleteThread?.bind(api),
        archive: api.changeArchivedStatus?.bind(api),
        mute: api.muteThread?.bind(api),
        handleRequest: api.handleMessageRequest?.bind(api),
    };
}

function buildFallbackUsers(api) {
    return {
        getInfo: api.getUserInfo?.bind(api),
        getInfoV2: api.getUserInfoV2?.bind(api),
        getID: api.getUserID?.bind(api),
        getFriendsList: api.getFriendsList?.bind(api),
    };
}

function buildFallbackAccount(api) {
    return {
        getCurrentUserID: api.getCurrentUserID?.bind(api),
        changeAvatar: api.changeAvatar?.bind(api),
        changeBio: api.changeBio?.bind(api),
        changeBlocked: api.changeBlockedStatus?.bind(api),
        handleFriendReq: api.handleFriendRequest?.bind(api),
        unfriend: api.unfriend?.bind(api),
        setPostReaction: api.setPostReaction?.bind(api),
        refreshDtsg: api.refreshFb_dtsg?.bind(api),
        logout: api.logout?.bind(api),
        addModule: api.addExternalModule?.bind(api),
        enableAutoSave: api.enableAutoSaveAppState?.bind(api),
    };
}

function buildFallbackRealtime(api) {
    return {
        listen: api.listenMqtt?.bind(api),
        stopListening: api.stopListening?.bind(api),
    };
}

function buildFallbackHttp(api) {
    return {
        get: api.httpGet?.bind(api),
        post: api.httpPost?.bind(api),
        postFormData: api.httpPostFormData?.bind(api),
    };
}

function buildFallbackScheduler(api) {
    return {
        schedule: api.scheduler?.schedule?.bind(api.scheduler),
    };
}

function createFcaClient(api, options = {}) {
    const raw = api || {};

    const existingMessages = typeof raw.messages === "object" && raw.messages !== null ? raw.messages : null;
    const existingThreads = typeof raw.threads === "object" && raw.threads !== null ? raw.threads : null;
    const existingUsers = typeof raw.users === "object" && raw.users !== null ? raw.users : null;
    const existingAccount = typeof raw.account === "object" && raw.account !== null ? raw.account : null;
    const existingRealtime = typeof raw.realtime === "object" && raw.realtime !== null ? raw.realtime : null;
    const existingHttp = typeof raw.http === "object" && raw.http !== null ? raw.http : null;
    const existingScheduler = typeof raw.scheduler === "object" && raw.scheduler !== null ? raw.scheduler : null;

    const fallbackMessages = compactNamespace(buildFallbackMessages(raw));
    const fallbackThreads = compactNamespace(buildFallbackThreads(raw));
    const fallbackUsers = compactNamespace(buildFallbackUsers(raw));
    const fallbackAccount = compactNamespace(buildFallbackAccount(raw));
    const fallbackRealtime = compactNamespace(buildFallbackRealtime(raw));
    const fallbackHttp = compactNamespace(buildFallbackHttp(raw));
    const fallbackScheduler = compactNamespace(buildFallbackScheduler(raw));

    const messages = Object.assign({}, fallbackMessages, existingMessages);
    const threads = Object.assign({}, fallbackThreads, existingThreads);
    const users = Object.assign({}, fallbackUsers, existingUsers);
    const account = Object.assign({}, fallbackAccount, existingAccount);
    const realtime = Object.assign({}, fallbackRealtime, existingRealtime);
    const http = Object.assign({}, fallbackHttp, existingHttp);
    const scheduler = Object.assign({}, fallbackScheduler, existingScheduler);

    let domainsManager = null;
    let capabilities = null;
    let realtimeManager = null;

    if (options.useEnhancedDomains !== false) {
        try {
            domainsManager = new DomainsManager(raw, options);
            capabilities = new CapabilityResolver(options);
            realtimeManager = new MqttRealtimeManager(options);
        } catch (error) {
            // Enhanced domains optional fallback
        }
    }

    const client = {
        raw,
        messages: existingMessages ? messages : (domainsManager?.messages || messages),
        threads: existingThreads ? threads : (domainsManager?.threads || threads),
        users: existingUsers ? users : (domainsManager?.users || users),
        account: existingAccount ? account : (domainsManager?.account || account),
        realtime: existingRealtime ? realtime : (domainsManager?.realtime || realtime),
        http,
        scheduler,
    };

    if (domainsManager) {
        client.domains = domainsManager;
        client.capabilities = capabilities;
        client.realtimeManager = realtimeManager;
        client.useMiddleware = domainsManager.useMiddleware.bind(domainsManager);
        client.useDomainMiddleware = domainsManager.useDomainMiddleware.bind(domainsManager);
        client.clearCache = domainsManager.clearAllCaches.bind(domainsManager);
        client.getStatus = domainsManager.getStatus.bind(domainsManager);
        client.getAvailableMethods = domainsManager.getAvailableMethods.bind(domainsManager);
    }

    return client;
}

function attachClientFacade(api, options = {}) {
    const client = createFcaClient(api, options);
    api.client = client;
    
    // Attach namespaces to api for direct access
    if (!api.messages) api.messages = client.messages;
    if (!api.threads) api.threads = client.threads;
    if (!api.users) api.users = client.users;
    if (!api.account) api.account = client.account;
    if (!api.realtime) api.realtime = client.realtime;
    if (!api.http) api.http = client.http;
    if (!api.scheduler) api.scheduler = client.scheduler;
    
    // Attach domain manager if available
    if (client.domains) {
        api.domains = client.domains;
        api.capabilities = client.capabilities;
        api.realtimeManager = client.realtimeManager;
    }
    
    return client;
}

/**
 * Create message domain (legacy wrapper for compatibility)
 */
function createMessagesDomain(api, options = {}) {
    if (options.useEnhancedDomains !== false) {
        try {
            return new MessagesDomain(api, "messages", options);
        } catch (error) {
            // Fall back to legacy
        }
    }
    return compactNamespace(buildFallbackMessages(api));
}

/**
 * Create thread domain (legacy wrapper for compatibility)
 */
function createThreadsDomain(api, options = {}) {
    if (options.useEnhancedDomains !== false) {
        try {
            return new ThreadsDomain(api, "threads", options);
        } catch (error) {
            // Fall back to legacy
        }
    }
    return compactNamespace(buildFallbackThreads(api));
}

/**
 * Create user domain (legacy wrapper for compatibility)
 */
function createUsersDomain(api, options = {}) {
    if (options.useEnhancedDomains !== false) {
        try {
            return new UsersDomain(api, "users", options);
        } catch (error) {
            // Fall back to legacy
        }
    }
    return compactNamespace(buildFallbackUsers(api));
}

/**
 * Create account domain (legacy wrapper for compatibility)
 */
function createAccountDomain(api, options = {}) {
    if (options.useEnhancedDomains !== false) {
        try {
            return new AccountDomain(api, "account", options);
        } catch (error) {
            // Fall back to legacy
        }
    }
    return compactNamespace(buildFallbackAccount(api));
}

/**
 * Create realtime domain (legacy wrapper for compatibility)
 */
function createRealtimeDomain(api, options = {}) {
    if (options.useEnhancedDomains !== false) {
        try {
            return new RealtimeDomain(api, "realtime", options);
        } catch (error) {
            // Fall back to legacy
        }
    }
    return compactNamespace(buildFallbackRealtime(api));
}

function createHttpDomain(api) {
    return compactNamespace(buildFallbackHttp(api));
}

function createSchedulerDomain(api) {
    return compactNamespace(buildFallbackScheduler(api));
}

module.exports = {
    createFcaClient,
    attachClientFacade,
    createMessagesDomain,
    createThreadsDomain,
    createUsersDomain,
    createAccountDomain,
    createRealtimeDomain,
    createHttpDomain,
    createSchedulerDomain,
    
    // Export new utilities
    DomainsManager,
    MessagesDomain,
    ThreadsDomain,
    UsersDomain,
    AccountDomain,
    RealtimeDomain,
    CapabilityResolver,
    MqttRealtimeManager,
};
