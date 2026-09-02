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
     * Get current user ID
     */
    getCurrentUserID(callback) {
        if (typeof this.api.getCurrentUserID === "function") {
            const res = this.api.getCurrentUserID();
            if (typeof callback === "function") callback(null, res);
            return res;
        }
        return null;
    }

    /**
     * Get current app state
     */
    getAppState(callback) {
        if (typeof this.api.getAppState === "function") {
            const res = this.api.getAppState();
            if (typeof callback === "function") callback(null, res);
            return res;
        }
        return null;
    }

    /**
     * Set post reaction
     */
    async setPostReaction(postID, reaction, callback) {
        const context = {
            operation: "setPostReaction",
            postID,
            reaction,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "setPostReaction");

        if (context.error) throw context.error;

        return this.api.setPostReaction(postID, reaction, callback);
    }

    /**
     * Refresh fb_dtsg
     */
    async refreshDtsg(callback) {
        const context = {
            operation: "refreshDtsg",
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "refreshDtsg");

        if (context.error) throw context.error;

        return this.api.refreshFb_dtsg?.(callback);
    }

    /**
     * Change blocked status
     */
    async changeBlocked(userID, blocked, callback) {
        return this.api.changeBlockedStatus?.(userID, blocked, callback);
    }

    /**
     * Handle friend request
     */
    async handleFriendReq(userID, accept, callback) {
        return this.api.handleFriendRequest?.(userID, accept, callback);
    }

    /**
     * Unfriend
     */
    async unfriend(userID, callback) {
        return this.api.unfriend?.(userID, callback);
    }

    /**
     * Add module alias
     */
    async addModule(path, callback) {
        return this.addExternalModule(path, callback);
    }

    /**
     * Enable auto save alias
     */
    async enableAutoSave(path, interval, callback) {
        return this.enableAutoSaveAppState(path, interval, callback);
    }
}

function createAccountDomain(api, options = {}) {
    return new AccountDomain(api, "account", options);
}

module.exports = { AccountDomain, createAccountDomain };
