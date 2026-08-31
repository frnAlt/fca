"use strict";

const { Domain } = require("../Domain");

/**
 * Threads Domain - Handles thread management operations
 */
class ThreadsDomain extends Domain {
    constructor(api, name = "threads", options = {}) {
        super(api, name, options);
    }

    /**
     * Get thread info
     */
    async getInfo(threadID, callback) {
        const cached = this.getCached(`info:${threadID}`);
        if (cached) return cached;

        const context = {
            operation: "getInfo",
            threadID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "getInfo");

        if (context.error) throw context.error;

        const result = await this.api.getThreadInfo(threadID, callback);
        this.setCached(`info:${threadID}`, result);

        return result;
    }

    /**
     * Get thread list
     */
    async getList(limit, timestamp, callback) {
        const cached = this.getCached("list");
        if (cached) return cached;

        const context = {
            operation: "getList",
            limit,
            timestamp,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "getList");

        if (context.error) throw context.error;

        const result = await this.api.getThreadList(limit, timestamp, callback);
        this.setCached("list", result);

        return result;
    }

    /**
     * Get thread history
     */
    async getHistory(threadID, amount, timestamp, callback) {
        const cached = this.getCached(`history:${threadID}`);
        if (cached) return cached;

        const context = {
            operation: "getHistory",
            threadID,
            amount,
            timestamp,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "getHistory");

        if (context.error) throw context.error;

        const result = await this.api.getThreadHistory(threadID, amount, timestamp, callback);
        this.setCached(`history:${threadID}`, result);

        return result;
    }

    /**
     * Get thread pictures
     */
    async getPictures(threadID, callback) {
        const cached = this.getCached(`pictures:${threadID}`);
        if (cached) return cached;

        const context = {
            operation: "getPictures",
            threadID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "getPictures");

        if (context.error) throw context.error;

        const result = await this.api.getThreadPictures(threadID, callback);
        this.setCached(`pictures:${threadID}`, result);

        return result;
    }

    /**
     * Create new group
     */
    async create(participantIds, title, callback) {
        const context = {
            operation: "create",
            participantIds,
            title,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "create");

        if (context.error) throw context.error;

        this.clearCache("list");
        return this.api.createNewGroup(participantIds, title, callback);
    }

    /**
     * Add user to group
     */
    async addUser(userID, threadID, callback) {
        const context = {
            operation: "addUser",
            userID,
            threadID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "addUser");

        if (context.error) throw context.error;

        this.clearCache(`info:${threadID}`);
        return this.api.addUserToGroup(userID, threadID, callback);
    }

    /**
     * Remove user from group
     */
    async removeUser(userID, threadID, callback) {
        const context = {
            operation: "removeUser",
            userID,
            threadID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "removeUser");

        if (context.error) throw context.error;

        this.clearCache(`info:${threadID}`);
        return this.api.removeUserFromGroup(userID, threadID, callback);
    }

    /**
     * Change admin status
     */
    async changeAdmin(userID, threadID, admin, callback) {
        const context = {
            operation: "changeAdmin",
            userID,
            threadID,
            admin,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "changeAdmin");

        if (context.error) throw context.error;

        this.clearCache(`info:${threadID}`);
        return this.api.changeAdminStatus(userID, threadID, admin, callback);
    }

    /**
     * Change thread color
     */
    async changeColor(color, threadID, callback) {
        const context = {
            operation: "changeColor",
            color,
            threadID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "changeColor");

        if (context.error) throw context.error;

        this.clearCache(`info:${threadID}`);
        return this.api.changeThreadColor(color, threadID, callback);
    }

    /**
     * Change thread emoji
     */
    async changeEmoji(emoji, threadID, callback) {
        const context = {
            operation: "changeEmoji",
            emoji,
            threadID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "changeEmoji");

        if (context.error) throw context.error;

        this.clearCache(`info:${threadID}`);
        return this.api.changeThreadEmoji(emoji, threadID, callback);
    }

    /**
     * Change thread title
     */
    async setTitle(title, threadID, callback) {
        const context = {
            operation: "setTitle",
            title,
            threadID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "setTitle");

        if (context.error) throw context.error;

        this.clearCache(`info:${threadID}`);
        return this.api.setTitle(title, threadID, callback);
    }

    /**
     * Change group image
     */
    async changeImage(imagePath, threadID, callback) {
        const context = {
            operation: "changeImage",
            imagePath,
            threadID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "changeImage");

        if (context.error) throw context.error;

        this.clearCache(`info:${threadID}`);
        return this.api.changeGroupImage(imagePath, threadID, callback);
    }

    /**
     * Search for thread
     */
    async search(searchQuery, callback) {
        const cached = this.getCached(`search:${searchQuery}`);
        if (cached) return cached;

        const context = {
            operation: "search",
            searchQuery,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "search");

        if (context.error) throw context.error;

        const result = await this.api.searchForThread(searchQuery, callback);
        this.setCached(`search:${searchQuery}`, result);

        return result;
    }

    /**
     * Mute thread
     */
    async mute(threadID, muteSeconds, callback) {
        const context = {
            operation: "mute",
            threadID,
            muteSeconds,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "mute");

        if (context.error) throw context.error;

        return this.api.muteThread(threadID, muteSeconds, callback);
    }
}

function createThreadsDomain(api, options = {}) {
    return new ThreadsDomain(api, "threads", options);
}

module.exports = { ThreadsDomain, createThreadsDomain };
