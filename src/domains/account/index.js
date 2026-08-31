"use strict";

const { Domain } = require("../Domain");

/**
 * Account Domain - Handles account-level operations
 */
class AccountDomain extends Domain {
    constructor(api, name = "account", options = {}) {
        super(api, name, options);
    }

    /**
     * Change avatar
     */
    async changeAvatar(imagePath, callback) {
        const context = {
            operation: "changeAvatar",
            imagePath,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "changeAvatar");

        if (context.error) throw context.error;

        this.clearCache("profile");
        return this.api.changeAvatar(imagePath, callback);
    }

    /**
     * Change bio
     */
    async changeBio(bio, callback) {
        const context = {
            operation: "changeBio",
            bio,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "changeBio");

        if (context.error) throw context.error;

        this.clearCache("profile");
        return this.api.changeBio(bio, callback);
    }

    /**
     * Get bot info
     */
    async getBotInfo(userID, callback) {
        const cached = this.getCached(`bot:${userID}`);
        if (cached) return cached;

        const context = {
            operation: "getBotInfo",
            userID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "getBotInfo");

        if (context.error) throw context.error;

        const result = await this.api.getBotInfo(userID, callback);
        this.setCached(`bot:${userID}`, result);

        return result;
    }

    /**
     * Get bot initial data
     */
    async getBotInitialData(callback) {
        const cached = this.getCached("botInitialData");
        if (cached) return cached;

        const context = {
            operation: "getBotInitialData",
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "getBotInitialData");

        if (context.error) throw context.error;

        const result = await this.api.getBotInitialData(callback);
        this.setCached("botInitialData", result);

        return result;
    }

    /**
     * Logout
     */
    async logout(callback) {
        const context = {
            operation: "logout",
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "logout");

        if (context.error) throw context.error;

        this.clearCache();
        return this.api.logout(callback);
    }

    /**
     * Handle message request
     */
    async handleMessageRequest(userID, accept, callback) {
        const context = {
            operation: "handleMessageRequest",
            userID,
            accept,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "handleMessageRequest");

        if (context.error) throw context.error;

        return this.api.handleMessageRequest(userID, accept, callback);
    }

    /**
     * Add external module
     */
    async addExternalModule(path, callback) {
        const context = {
            operation: "addExternalModule",
            path,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "addExternalModule");

        if (context.error) throw context.error;

        return this.api.addExternalModule(path, callback);
    }

    /**
     * Enable auto-save app state
     */
    async enableAutoSaveAppState(path, interval, callback) {
        const context = {
            operation: "enableAutoSaveAppState",
            path,
            interval,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "enableAutoSaveAppState");

        if (context.error) throw context.error;

        return this.api.enableAutoSaveAppState(path, interval, callback);
    }
}

function createAccountDomain(api, options = {}) {
    return new AccountDomain(api, "account", options);
}

module.exports = { AccountDomain, createAccountDomain };
