"use strict";

const { login, loginAsync, loginLegacy, DEFAULT_OPTIONS } = require('./src/engine/client');

const { MessengerBot, MessengerContext, createMessengerBot } = require('./src/app/MessengerBot');
const { 
    createFcaClient, 
    attachClientFacade, 
    createMessagesDomain, 
    createThreadsDomain, 
    createUsersDomain, 
    createAccountDomain, 
    createRealtimeDomain, 
    createHttpDomain, 
    createSchedulerDomain,
    DomainsManager,
    MessagesDomain,
    ThreadsDomain,
    UsersDomain,
    AccountDomain,
    RealtimeDomain,
    CapabilityResolver,
    MqttRealtimeManager
} = require('./src/app/createFcaClient');
const { defaultConfig, loadConfig, resolveConfig, writeConfigTemplate } = require('./src/app/config');
const { broadcast } = require('./src/app/broadcast');
const { attachThreadInfoRealtimeSync } = require('./src/app/threadSync');
const { checkForPackageUpdate, runConfiguredUpdateCheck } = require('./src/app/updateCheck');
const { createDefaultContext, createFcaState, createApiFacade, createRequestHelper } = require('./src/app/state');

const { normalizeCookieHeaderString, setJarFromPairs } = require('./src/utils/formatters/value/formatCookie');
const { createAuthCore } = require('./src/utils/auth-helpers');
const { FCAError, RetryHandler, ErrorTracker } = require('./src/utils/ErrorHandler');

// Stability & Resilience Utilities
const { BotHealthMonitor } = require('./src/utils/BotHealthMonitor');
const { SessionStabilityManager } = require('./src/utils/SessionStabilityManager');
const { AdaptiveRateLimiter } = require('./src/utils/AdaptiveRateLimiter');
const { ResilienceManager } = require('./src/utils/ResilienceManager');
const { RequestValidator } = require('./src/utils/RequestValidator');
const { LifecycleManager } = require('./src/utils/LifecycleManager');
const { SessionRecoveryManager } = require('./src/utils/SessionRecoveryManager');
const { ConnectionPoolManager } = require('./src/utils/ConnectionPoolManager');

module.exports = login;

module.exports.login = login;
module.exports.loginAsync = loginAsync;
module.exports.loginLegacy = loginLegacy;
module.exports.DEFAULT_OPTIONS = DEFAULT_OPTIONS;

module.exports.MessengerBot = MessengerBot;
module.exports.MessengerContext = MessengerContext;
module.exports.createMessengerBot = createMessengerBot;

module.exports.createFcaClient = createFcaClient;
module.exports.attachClientFacade = attachClientFacade;

module.exports.createMessagesDomain = createMessagesDomain;
module.exports.createThreadsDomain = createThreadsDomain;
module.exports.createUsersDomain = createUsersDomain;
module.exports.createAccountDomain = createAccountDomain;
module.exports.createRealtimeDomain = createRealtimeDomain;
module.exports.createHttpDomain = createHttpDomain;
module.exports.createSchedulerDomain = createSchedulerDomain;

// Export new domain-based architecture classes
module.exports.DomainsManager = DomainsManager;
module.exports.MessagesDomain = MessagesDomain;
module.exports.ThreadsDomain = ThreadsDomain;
module.exports.UsersDomain = UsersDomain;
module.exports.AccountDomain = AccountDomain;
module.exports.RealtimeDomain = RealtimeDomain;

// Export utilities
module.exports.CapabilityResolver = CapabilityResolver;
module.exports.MqttRealtimeManager = MqttRealtimeManager;
module.exports.FCAError = FCAError;
module.exports.RetryHandler = RetryHandler;
module.exports.ErrorTracker = ErrorTracker;

// Export Stability & Resilience Utilities
module.exports.BotHealthMonitor = BotHealthMonitor;
module.exports.SessionStabilityManager = SessionStabilityManager;
module.exports.AdaptiveRateLimiter = AdaptiveRateLimiter;
module.exports.ResilienceManager = ResilienceManager;
module.exports.RequestValidator = RequestValidator;
module.exports.LifecycleManager = LifecycleManager;
module.exports.SessionRecoveryManager = SessionRecoveryManager;
module.exports.ConnectionPoolManager = ConnectionPoolManager;

module.exports.defaultConfig = defaultConfig;
module.exports.loadConfig = loadConfig;
module.exports.resolveConfig = resolveConfig;
module.exports.writeConfigTemplate = writeConfigTemplate;

module.exports.broadcast = broadcast;
module.exports.attachThreadInfoRealtimeSync = attachThreadInfoRealtimeSync;

module.exports.checkForPackageUpdate = checkForPackageUpdate;
module.exports.runConfiguredUpdateCheck = runConfiguredUpdateCheck;

module.exports.createDefaultContext = createDefaultContext;
module.exports.createFcaState = createFcaState;
module.exports.createApiFacade = createApiFacade;
module.exports.createRequestHelper = createRequestHelper;

module.exports.normalizeCookieHeaderString = normalizeCookieHeaderString;
module.exports.setJarFromPairs = setJarFromPairs;
module.exports.createAuthCore = createAuthCore;

module.exports.getVersion = function getVersion() {
    return require('./package.json').version;
};
