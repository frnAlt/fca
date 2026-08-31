"use strict";

const { Domain } = require("../Domain");

/**
 * Messages Domain - Handles all message-related operations
 */
class MessagesDomain extends Domain {
    constructor(api, name = "messages", options = {}) {
        super(api, name, options);
    }

    /**
     * Send message
     */
    async send(payload, threadID, callback) {
        const cached = this.getCached(`send:${threadID}`);
        if (cached) return cached;

        const context = {
            operation: "send",
            payload,
            threadID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "send");

        if (context.error) throw context.error;

        const result = await this.api.sendMessage(payload, threadID, callback);
        this.setCached(`send:${threadID}`, result);

        return result;
    }

    /**
     * Edit message
     */
    async edit(messageID, newText, callback) {
        const context = {
            operation: "edit",
            messageID,
            newText,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "edit");

        if (context.error) throw context.error;

        this.clearCache(`message:${messageID}`);
        return this.api.editMessage(messageID, newText, callback);
    }

    /**
     * Unsend message
     */
    async unsend(messageID, callback) {
        const context = {
            operation: "unsend",
            messageID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "unsend");

        if (context.error) throw context.error;

        this.clearCache(`message:${messageID}`);
        return this.api.unsendMessage(messageID, callback);
    }

    /**
     * Delete message
     */
    async delete(messageID, callback) {
        const context = {
            operation: "delete",
            messageID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "delete");

        if (context.error) throw context.error;

        this.clearCache(`message:${messageID}`);
        return this.api.deleteMessage(messageID, callback);
    }

    /**
     * Get message
     */
    async get(messageID, callback) {
        const cached = this.getCached(`message:${messageID}`);
        if (cached) return cached;

        const context = {
            operation: "get",
            messageID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "get");

        if (context.error) throw context.error;

        const result = await this.api.getMessage(messageID, callback);
        this.setCached(`message:${messageID}`, result);

        return result;
    }

    /**
     * Set message reaction
     */
    async setReaction(messageID, reaction, callback) {
        const context = {
            operation: "setReaction",
            messageID,
            reaction,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "setReaction");

        if (context.error) throw context.error;

        return this.api.setMessageReaction(messageID, reaction, callback);
    }

    /**
     * Send typing indicator
     */
    async sendTyping(threadID, isTyping, callback) {
        const context = {
            operation: "sendTyping",
            threadID,
            isTyping,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "sendTyping");

        if (context.error) throw context.error;

        return this.api.sendTypingIndicator(threadID, isTyping, callback);
    }

    /**
     * Mark as read
     */
    async markAsRead(threadID, callback) {
        const context = {
            operation: "markAsRead",
            threadID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "markAsRead");

        if (context.error) throw context.error;

        return this.api.markAsRead(threadID, callback);
    }

    /**
     * Mark as delivered
     */
    async markAsDelivered(threadID, messageID, callback) {
        const context = {
            operation: "markAsDelivered",
            threadID,
            messageID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "markAsDelivered");

        if (context.error) throw context.error;

        return this.api.markAsDelivered(threadID, messageID, callback);
    }

    /**
     * Mark as seen
     */
    async markAsSeen(threadID, callback) {
        const context = {
            operation: "markAsSeen",
            threadID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "markAsSeen");

        if (context.error) throw context.error;

        return this.api.markAsSeen(threadID, callback);
    }

    /**
     * Forward message
     */
    async forward(messageID, threadID, callback) {
        const context = {
            operation: "forward",
            messageID,
            threadID,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "forward");

        if (context.error) throw context.error;

        return this.api.forwardMessage(messageID, threadID, callback);
    }

    /**
     * Upload attachment
     */
    async uploadAttachment(filePath, callback) {
        const context = {
            operation: "uploadAttachment",
            filePath,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "uploadAttachment");

        if (context.error) throw context.error;

        return this.api.uploadAttachment(filePath, callback);
    }

    /**
     * Get emoji URL
     */
    async getEmojiUrl(pack, id, callback) {
        const cached = this.getCached(`emoji:${pack}:${id}`);
        if (cached) return cached;

        const context = {
            operation: "getEmojiUrl",
            pack,
            id,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "getEmojiUrl");

        if (context.error) throw context.error;

        const result = await this.api.getEmojiUrl(pack, id, callback);
        this.setCached(`emoji:${pack}:${id}`, result);

        return result;
    }

    /**
     * Resolve photo URL
     */
    async resolvePhotoUrl(photoUrl, callback) {
        const cached = this.getCached(`photo:${photoUrl}`);
        if (cached) return cached;

        const context = {
            operation: "resolvePhotoUrl",
            photoUrl,
            timestamp: Date.now()
        };

        await this.executeMiddleware(context, "resolvePhotoUrl");

        if (context.error) throw context.error;

        const result = await this.api.resolvePhotoUrl(photoUrl, callback);
        this.setCached(`photo:${photoUrl}`, result);

        return result;
    }
}

function createMessagesDomain(api, options = {}) {
    return new MessagesDomain(api, "messages", options);
}

module.exports = { MessagesDomain, createMessagesDomain };
