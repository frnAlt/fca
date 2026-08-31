"use strict";

const { Domain } = require("../Domain");

/**
 * Users Domain - Handles user-related operations
 */
class UsersDomain extends Domain {
    constructor(api, name = "users", options = {}) {
        super(api, name, options);
    }

    /**
     * Get user info
     */
    async getInfo(userID, callback) {
        const cached = this.getCached(`info:${userID}`);
        if (cached) return cached;

        const context = {
            operation: "getInfo",
            userID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "getInfo");

        if (context.error) throw context.error;

        const result = await this.api.getUserInfo(userID, callback);
        this.setCached(`info:${userID}`, result);

        return result;
    }

    /**
     * Get user info v2
     */
    async getInfoV2(userID, callback) {
        const cached = this.getCached(`infov2:${userID}`);
        if (cached) return cached;

        const context = {
            operation: "getInfoV2",
            userID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "getInfoV2");

        if (context.error) throw context.error;

        const result = await this.api.getUserInfoV2(userID, callback);
        this.setCached(`infov2:${userID}`, result);

        return result;
    }

    /**
     * Get user ID from email or phone
     */
    async getUserID(email, callback) {
        const cached = this.getCached(`id:${email}`);
        if (cached) return cached;

        const context = {
            operation: "getUserID",
            email,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "getUserID");

        if (context.error) throw context.error;

        const result = await this.api.getUserID(email, callback);
        this.setCached(`id:${email}`, result);

        return result;
    }

    /**
     * Get friends list
     */
    async getFriendsList(callback) {
        const cached = this.getCached("friends");
        if (cached) return cached;

        const context = {
            operation: "getFriendsList",
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "getFriendsList");

        if (context.error) throw context.error;

        const result = await this.api.getFriendsList(callback);
        this.setCached("friends", result);

        return result;
    }

    /**
     * Handle friend request
     */
    async handleFriendRequest(userID, accept, callback) {
        const context = {
            operation: "handleFriendRequest",
            userID,
            accept,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "handleFriendRequest");

        if (context.error) throw context.error;

        this.clearCache("friends");
        return this.api.handleFriendRequest(userID, accept, callback);
    }

    /**
     * Unfriend user
     */
    async unfriend(userID, callback) {
        const context = {
            operation: "unfriend",
            userID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "unfriend");

        if (context.error) throw context.error;

        this.clearCache("friends");
        this.clearCache(`info:${userID}`);
        return this.api.unfriend(userID, callback);
    }

    /**
     * Block/unblock user
     */
    async changeBlockedStatus(userID, blocked, callback) {
        const context = {
            operation: "changeBlockedStatus",
            userID,
            blocked,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "changeBlockedStatus");

        if (context.error) throw context.error;

        this.clearCache(`info:${userID}`);
        return this.api.changeBlockedStatus(userID, blocked, callback);
    }

    /**
     * Set nickname
     */
    async setNickname(userID, nickname, threadID, callback) {
        const context = {
            operation: "setNickname",
            userID,
            nickname,
            threadID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "setNickname");

        if (context.error) throw context.error;

        this.clearCache(`info:${userID}`);
        return this.api.nickname(userID, nickname, threadID, callback);
    }

    /**
     * Follow user
     */
    async follow(userID, callback) {
        const context = {
            operation: "follow",
            userID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "follow");

        if (context.error) throw context.error;

        this.clearCache(`info:${userID}`);
        return this.api.follow(userID, callback);
    }

    /**
     * Get access token/capabilities for user
     */
    async getAccess(userID, callback) {
        const cached = this.getCached(`access:${userID}`);
        if (cached) return cached;

        const context = {
            operation: "getAccess",
            userID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "getAccess");

        if (context.error) throw context.error;

        const result = await this.api.getAccess(userID, callback);
        this.setCached(`access:${userID}`, result);

        return result;
    }
}

function createUsersDomain(api, options = {}) {
    return new UsersDomain(api, "users", options);
}

module.exports = { UsersDomain, createUsersDomain };
