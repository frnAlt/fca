/// <reference types="node" />
import { ReadStream } from "fs";
import { EventEmitter } from "events";

declare module "@lazyneoaz/metachat" {
    export type UserID = string;
    export type ThreadID = string;
    export type MessageID = string;
    export type Callback<T = any> = (err: any, result?: T) => void;

    export interface Coordinates {
        latitude: number;
        longitude: number;
    }

    export interface Mention {
        tag: string;
        id: UserID;
        fromIndex?: number;
    }

    export interface Reaction {
        reaction: string;
        userID: UserID;
    }

    export interface StickerPackInfo {
        id: string;
        name: string;
        thumbnail?: string;
    }

    export interface StickerInfo {
        type: "sticker";
        ID: string;
        url?: string;
        animatedUrl?: string;
        packID?: string;
        label: string;
        stickerID: string;
    }

    export interface AddedStickerPackInfo {
        id: string;
        name: string;
        in_sticker_tray: boolean;
        artist?: string;
        preview_image?: { uri: string };
        thumbnail_image?: { uri: string };
    }

    export interface CommentMessage {
        body: string;
        attachment?: ReadStream[];
        mentions?: Mention[];
        url?: string;
        sticker?: string;
    }

    export interface CommentResult {
        id: string;
        url: string;
        count: number;
    }

    export interface ShareResult {
        postID: string;
        url: string;
    }

    export interface Attachment {
        type: "photo" | "animated_image" | "video" | "audio" | "file" | "sticker" | "share" | "location" | "unknown";
        ID: string;
        filename: string;
        url?: string;
        name?: string;
    }

    export interface PhotoAttachment extends Attachment {
        type: "photo";
        thumbnailUrl: string;
        previewUrl: string;
        previewWidth: number;
        previewHeight: number;
        largePreviewUrl: string;
        largePreviewWidth: number;
        largePreviewHeight: number;
        width: number;
        height: number;
    }

    export interface VideoAttachment extends Attachment {
        type: "video";
        duration: number;
        width: number;
        height: number;
        previewUrl: string;
        previewWidth: number;
        previewHeight: number;
        videoType: "file_attachment" | "native_video" | "unknown";
    }

    export interface AudioAttachment extends Attachment {
        type: "audio";
        duration: number;
        audioType: string;
        isVoiceMail: boolean;
    }

    export interface FileAttachment extends Attachment {
        type: "file";
        isMalicious: boolean;
        contentType: string;
    }

    export interface StickerAttachment extends Attachment {
        type: "sticker";
        packID: string;
        spriteUrl?: string;
        spriteUrl2x?: string;
        width: number;
        height: number;
        caption: string;
        description: string;
        frameCount: number;
        frameRate: number;
        framesPerRow: number;
        framesPerCol: number;
    }

    export interface ShareAttachment extends Attachment {
        type: "share";
        title: string;
        description?: string;
        source?: string;
        image?: string;
        width?: number;
        height?: number;
        playable?: boolean;
        subattachments?: any[];
        properties: Record<string, any>;
    }

    export type AnyAttachment =
        | PhotoAttachment
        | VideoAttachment
        | AudioAttachment
        | FileAttachment
        | StickerAttachment
        | ShareAttachment;

    export interface MessageReply {
        messageID: MessageID;
        senderID: UserID;
        body: string;
        attachments: AnyAttachment[];
        timestamp: string;
        isReply: true;
    }

    export interface Message {
        type: "message";
        senderID: UserID;
        body: string;
        threadID: ThreadID;
        messageID: MessageID;
        attachments: AnyAttachment[];
        mentions: Record<string, string>;
        timestamp: string;
        isGroup: boolean;
        participantIDs?: UserID[];
        messageReply?: MessageReply;
        isUnread?: boolean;
        reactions?: Reaction[];
    }

    export interface Event {
        type: "event";
        threadID: ThreadID;
        logMessageType: string;
        logMessageData: any;
        logMessageBody: string;
        timestamp: string;
        author: UserID;
    }

    export interface TypingIndicator {
        type: "typ";
        isTyping: boolean;
        from: UserID;
        threadID: ThreadID;
        fromMobile: boolean;
    }

    export interface UnsendMessageEvent {
        type: "unsend";
        messageID: MessageID;
        threadID: ThreadID;
        senderID: UserID;
        deletionTimestamp: string;
    }

    export interface EmojiEvent {
        type: "change_thread_emoji";
        threadID: ThreadID;
        author: UserID;
        emoji: string;
    }

    export interface GroupNameEvent {
        type: "change_thread_name";
        threadID: ThreadID;
        author: UserID;
        name: string;
    }

    export interface NicknameEvent {
        type: "change_thread_nickname";
        threadID: ThreadID;
        author: UserID;
        participantID: UserID;
        nickname: string;
    }

    export type ListenEvent = Message | Event | TypingIndicator;

    export interface UserInfo {
        id: UserID;
        name: string;
        firstName: string;
        lastName?: string;
        vanity: string;
        profileUrl: string;
        profilePicUrl: string;
        gender: string;
        type: "user" | "page";
        isFriend: boolean;
        isBirthday: boolean;
        bio?: string;
        live_city?: string;
        followers?: string;
        following?: string;
        coverPhoto?: string;
    }

    export interface ThreadInfo {
        threadID: ThreadID;
        threadName?: string;
        participantIDs: UserID[];
        userInfo: UserInfo[];
        unreadCount: number;
        messageCount: number;
        imageSrc?: string;
        timestamp: string;
        muteUntil: number;
        isGroup: boolean;
        isArchived: boolean;
        isSubscribed: boolean;
        folder: string;
        nicknames: Record<UserID, string>;
        adminIDs: UserID[];
        emoji?: string;
        color?: string;
        canReply: boolean;
        inviteLink: {
            enable: boolean;
            link: string | null;
        };
    }

    export interface MessageObject {
        body?: string;
        attachment?: ReadStream | ReadStream[];
        sticker?: string;
        emoji?: string;
        emojiSize?: "small" | "medium" | "large";
        mentions?: Mention[];
        edit?: [string, number][];
        url?: string;
        location?: Coordinates;
    }

    export interface FriendInfo {
        alternateName: string;
        firstName: string;
        gender: string;
        userID: UserID;
        isFriend: boolean;
        fullName: string;
        profilePicture: string;
        type: string;
        profileUrl: string;
        vanity: string;
        isBirthday: boolean;
    }

    export interface HealthStatus {
        mqttConnected: boolean;
        autoReconnect: boolean;
        tokenRefresh: {
            lastRefresh: number;
            nextRefresh: number;
            failureCount: number;
        };
        rateLimiter: {
            activeRequests: number;
            maxConcurrentRequests: number;
            maxRequestsPerMinute: number;
            threadCooldowns: number;
            endpointCooldowns: number;
            errorCacheSize: number;
        } | null;
    }

    export interface API {
        setOptions(options: LoginOptions): void;
        getAppState(): any[];
        getCurrentUserID(): UserID;
        getHealthStatus(): HealthStatus;

        listen(callback: (err: any, event: ListenEvent) => void): EventEmitter;

        listenMqtt(callback: (err: any, event: ListenEvent) => void): EventEmitter;

        stopListening(callback?: () => void): void;
        stopListeningAsync(): Promise<void>;

        reconnect(callback?: (err: Error | null) => void): Promise<void>;
        getReconnectStatus(): {
            connected: boolean;
            reconnectAttempts: number;
            totalReconnects: number;
            lastAttemptAt: number | null;
            nextAttemptAt: number | null;
            lastSuccessAt: number | null;
            reconnectPending: boolean;
            autoReconnect: boolean;
            options: {
                cycleMs: number;
                reconnectDelayMs: number;
                autoReconnect: boolean;
                watchdogIntervalMs: number;
                staleMs: number;
                reconnectAfterStop: boolean;
                maxReconnectAttempts: number;
            };
        };
        setReconnectOptions(options: {
            cycleMs?: number;
            reconnectDelayMs?: number;
            autoReconnect?: boolean;
            watchdogIntervalMs?: number;
            staleMs?: number;
            reconnectAfterStop?: boolean;
            maxReconnectAttempts?: number;
        }): object;

        useMiddleware(nameOrFn: string | Function, fn?: Function): () => void;
        removeMiddleware(identifier: string | Function): boolean;
        clearMiddleware(): void;
        listMiddleware(): string[];
        setMiddlewareEnabled(name: string, enabled: boolean): boolean;

        sendMessage(
            message: string | MessageObject,
            threadID: ThreadID,
            replyToMessage?: MessageID | Callback<Message>,
            callback?: Callback<Message>,
        ): Promise<Message> | void;

        sendMessageMqtt(
            message: string | MessageObject,
            threadID: ThreadID,
            replyToMessage?: MessageID,
            callback?: Callback<Message>,
        ): void;

        editMessage(text: string, messageID: MessageID, callback?: Callback): void;

        unsendMessage(messageID: MessageID, threadID: ThreadID, callback?: Callback<UnsendMessageEvent>): Promise<UnsendMessageEvent>;

        forwardMessage(messageID: MessageID, threadID: ThreadID, callback?: Callback): Promise<void>;

        deleteMessage(messageIDs: MessageID | MessageID[], callback?: Callback): Promise<void>;

        setMessageReaction(reaction: string, messageID: MessageID, callback?: Callback, forceCustomReaction?: boolean): Promise<void>;
        setMessageReactionMqtt(reaction: string, messageID: MessageID, threadID: ThreadID, callback?: Callback): Promise<void>;

        shareContact(text: string, senderID: UserID, threadID: ThreadID, callback?: Callback): void;
        shareContact(senderID: UserID, threadID: ThreadID, callback?: Callback): void;
        resolvePhotoUrl(photoID: string, callback?: Callback<string>): Promise<string>;

        pinMessage(action: "pin" | "unpin", threadID: ThreadID, messageID: MessageID): Promise<any>;
        pinMessage(action: "list", threadID: ThreadID): Promise<Message[]>;

        markAsRead(threadID: ThreadID, read?: boolean, callback?: Callback): Promise<any>;
        markAsReadAll(callback?: Callback): Promise<void>;
        markAsSeen(timestamp?: number, callback?: Callback): Promise<void>;
        markAsDelivered(threadID: ThreadID, messageID: MessageID, callback?: Callback): Promise<void>;

        muteThread(threadID: ThreadID, muteSeconds: number, callback?: Callback): Promise<void>;

        sendTypingIndicator(sendTyping: boolean, threadID: ThreadID, callback?: Callback): Promise<void>;

        getThreadInfo(threadID: ThreadID, callback?: Callback<ThreadInfo>): Promise<ThreadInfo>;
        getThreadInfo(threadID: ThreadID[], callback?: Callback<Record<ThreadID, ThreadInfo>>): Promise<Record<ThreadID, ThreadInfo>>;

        getThreadList(limit: number, timestamp: number | null, tags: string[], callback?: Callback<ThreadInfo[]>): Promise<ThreadInfo[]>;
        getThreadHistory(threadID: ThreadID, amount: number, timestamp: number | null, callback?: Callback<Message[]>): Promise<Message[]>;
        getThreadPictures(threadID: ThreadID, offset: number, limit: number, callback?: Callback<string[]>): Promise<string[]>;

        getMessage(messageID: MessageID, callback?: Callback<Message>): Promise<Message>;

        getUserInfo(id: UserID, usePayload?: boolean, callback?: Callback<UserInfo>): Promise<UserInfo>;
        getUserInfo(id: UserID[], usePayload?: boolean, callback?: Callback<Record<UserID, UserInfo>>): Promise<Record<UserID, UserInfo>>;
        getUserInfoV2(id: UserID, callback?: Callback<UserInfo>): Promise<UserInfo>;
        getUserID(name: string, callback?: Callback<{ userID: UserID; [key: string]: any }[]>): Promise<{ userID: UserID; [key: string]: any }[]>;

        getFriendsList(callback?: Callback<Record<UserID, FriendInfo>>): Promise<Record<UserID, FriendInfo>>;

        searchForThread(name: string, callback?: Callback<ThreadInfo[]>): Promise<ThreadInfo[]>;

        createNewGroup(participantIDs: UserID[], groupName?: string, callback?: Callback<ThreadID>): Promise<ThreadID>;

        addUserToGroup(userID: UserID, threadID: ThreadID, callback?: Callback): Promise<void>;
        removeUserFromGroup(userID: UserID, threadID: ThreadID, callback?: Callback): Promise<void>;
        changeAdminStatus(threadID: ThreadID, userID: UserID, adminStatus: boolean, callback?: Callback): Promise<void>;

        changeGroupImage(image: ReadStream, threadID: ThreadID, callback?: Callback): Promise<void>;
        changeThreadColor(color: string, threadID: ThreadID, callback?: Callback): Promise<void>;
        changeThreadEmoji(emoji: string, threadID: ThreadID, callback?: Callback): Promise<void>;

        changeArchivedStatus(threadID: ThreadID | ThreadID[], archive: boolean, callback?: Callback): Promise<void>;
        changeBlockedStatus(userID: UserID, block: boolean, callback?: Callback): Promise<void>;

        changeAvatar(image: ReadStream, callback?: Callback): Promise<void>;
        changeBio(bio: string, publish: boolean, callback?: Callback): Promise<void>;

        handleMessageRequest(threadID: ThreadID | ThreadID[], accept: boolean, callback?: Callback): Promise<void>;

        deleteThread(threadID: ThreadID | ThreadID[], callback?: Callback): Promise<void>;

        createPoll(title: string, threadID: ThreadID, options?: Record<string, boolean>, callback?: Callback): Promise<void>;

        logout(callback?: (err: any) => void): Promise<void>;

        addExternalModule(moduleObj: Record<string, Function>): void;
        getAccess(authCode?: string, callback?: Callback<string>): Promise<string>;

        httpGet(url: string, form?: any, customHeader?: any, callback?: Callback<string>, notAPI?: boolean): Promise<string>;
        httpPost(url: string, form?: any, customHeader?: any, callback?: Callback<string>, notAPI?: boolean): Promise<string>;
        httpPostFormData(url: string, form?: any, customHeader?: any, callback?: Callback<string>, notAPI?: boolean): Promise<string>;

        getTheme(threadID: ThreadID): Promise<any[]>;
        getThemeInfo(threadID: ThreadID): Promise<{ threadName?: string; color?: string; emoji?: string; [key: string]: any }>;
        setThreadTheme(threadID: ThreadID, themeID: string, callback?: Callback): Promise<void>;
        setThreadThemeMqtt(threadID: ThreadID, themeID: string, callback?: Callback): Promise<void>;
        createAITheme(prompt: string): Promise<{ id: string; [key: string]: any }[]>;

        follow(senderID: UserID, follow: boolean, callback?: Callback): void;
        unfriend(userID: UserID, callback?: Callback): Promise<void>;
        friend(userID: UserID, callback?: Callback): Promise<void>;

        emoji(emoji: string, threadID?: ThreadID, callback?: Callback<EmojiEvent>): Promise<EmojiEvent>;
        gcname(newName: string, threadID?: ThreadID, callback?: Callback<GroupNameEvent>): Promise<GroupNameEvent>;
        nickname(nickname: string, threadID: ThreadID, participantID: UserID, callback?: Callback<NicknameEvent>): Promise<NicknameEvent>;
        theme(newName: string, threadID?: ThreadID, callback?: Callback<GroupNameEvent>): Promise<GroupNameEvent>;

        comment(msg: string | CommentMessage, postID: string, replyCommentID?: string, callback?: Callback<CommentResult>): Promise<CommentResult>;
        share(text: string, postID: string, callback?: Callback<ShareResult>): Promise<ShareResult>;
        share(postID: string, callback?: Callback<ShareResult>): Promise<ShareResult>;

        stickers: {
            search(query: string): Promise<StickerInfo[]>;
            listPacks(): Promise<StickerPackInfo[]>;
            getStorePacks(): Promise<StickerPackInfo[]>;
            listAllPacks(): Promise<StickerPackInfo[]>;
            addPack(packID: string): Promise<AddedStickerPackInfo>;
            getStickersInPack(packID: string): Promise<StickerInfo[]>;
            getAiStickers(options?: { limit?: number }): Promise<StickerInfo[]>;
        };

        e2ee: {
            enable(): void;
            disable(): void;
            isEnabled(): boolean;
            getPublicKey(): string;
            setPeerKey(threadID: ThreadID, peerPublicKeyB64: string): void;
            clearPeerKey(threadID: ThreadID): void;
            hasPeer(threadID: ThreadID): boolean;
            encrypt(threadID: ThreadID, text: string): string;
            decrypt(threadID: ThreadID, armored: string): string | null;
        };

        getBotInfo(callback?: Callback): Promise<any>;
        getUserInfoV2(userID: UserID, callback?: Callback<UserInfo>): Promise<UserInfo>;

        [key: string]: any;
    }

    export interface LoginCredentials {
        appState?: any;
        email?: string;
        password?: string;
    }

    export interface LoginOptions {
        online?: boolean;
        selfListen?: boolean;
        listenEvents?: boolean;
        updatePresence?: boolean;
        forceLogin?: boolean;
        autoMarkDelivery?: boolean;
        autoMarkRead?: boolean;
        listenTyping?: boolean;
        proxy?: string;
        autoReconnect?: boolean;
        userAgent?: string;
        emitReady?: boolean;
        randomUserAgent?: boolean;
        bypassRegion?: string;
        simulateTyping?: boolean;
        maxConcurrentRequests?: number;
        maxRequestsPerMinute?: number;
        requestCooldownMs?: number;
        errorCacheTtlMs?: number;
        stealthMode?: boolean;
        persona?: "desktop" | "android" | "mobile";
        logging?: boolean;
    }

    export function login(
        credentials: LoginCredentials,
        options: LoginOptions | Callback<API>,
        callback?: Callback<API>
    ): Promise<API> | void;

    export function getVersion(): string;
}
