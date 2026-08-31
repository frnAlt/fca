/**
 * Enhanced MetaChat Types - Domain-Based Architecture
 */

declare namespace MetaChat {
    // Error Handling Types
    interface FCAErrorOptions {
        code?: string;
        details?: Record<string, any>;
    }

    interface RetryHandlerOptions {
        maxRetries?: number;
        baseDelay?: number;
        maxDelay?: number;
        backoffMultiplier?: number;
        jitter?: boolean;
    }

    interface ErrorEntry {
        timestamp: Date;
        message: string;
        code: string;
        stack: string;
        context: Record<string, any>;
    }

    interface ErrorStats {
        total: number;
        byCode: Record<string, number>;
        recentErrors: ErrorEntry[];
    }

    // MQTT Realtime Manager Types
    interface MqttRealtimeManagerOptions {
        autoConnect?: boolean;
        reconnectInterval?: number;
        maxReconnectAttempts?: number;
        seqIdRefreshInterval?: number;
    }

    interface MqttRealtimeState {
        state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
        connected: boolean;
        seqId: string | null;
        seqIdStale: boolean;
        listenerCount: number;
    }

    // Capability Resolver Types
    interface CapabilityMetadata {
        enabled: boolean;
        lastChecked: number;
        metadata?: Record<string, any>;
    }

    interface CapabilityResolverOptions {
        supportedLocales?: string[];
        locale?: string;
        clientVersion?: string;
    }

    interface CapabilityStatus {
        total: number;
        enabled: number;
        disabled: number;
        percentage: number;
        features: Record<string, boolean>;
    }

    // Domain Types
    interface DomainOptions {
        cacheEnabled?: boolean;
        cacheTTL?: number;
        middleware?: Array<(context: any, next: () => Promise<void>, domain: Domain) => Promise<void>>;
    }

    interface CacheStats {
        size: number;
        enabled: boolean;
        ttl: number;
    }

    // Domains Manager Types
    interface DomainsManagerOptions extends DomainOptions {
        messageCacheEnabled?: boolean;
        messageCacheTTL?: number;
        threadCacheEnabled?: boolean;
        threadCacheTTL?: number;
        userCacheEnabled?: boolean;
        userCacheTTL?: number;
        accountCacheEnabled?: boolean;
        accountCacheTTL?: number;
        realtimeCacheEnabled?: boolean;
        realtimeCacheTTL?: number;
    }

    interface DomainsStatus {
        [key: string]: {
            cache: CacheStats;
            middleware: number;
        };
    }

    interface AvailableMethods {
        [key: string]: string[];
    }

    // Messages Domain Types
    interface SendMessageOptions {
        body?: string;
        attachments?: Array<{ type: string; url: string }>;
        sticker?: string;
        mentions?: Record<string, string>;
        emojiSize?: string;
        emojiUrl?: string;
    }

    interface MessageReaction {
        emoji: string;
        reaction: boolean;
    }

    // Threads Domain Types
    interface ThreadInfo {
        threadID: string;
        participantIDs: string[];
        name: string;
        snippet: string;
        [key: string]: any;
    }

    interface ThreadList {
        threads: ThreadInfo[];
        pageInfo?: {
            before?: string;
            after?: string;
        };
    }

    interface MessageHistory {
        messages: any[];
        pageInfo?: {
            before?: string;
            after?: string;
        };
    }

    // Users Domain Types
    interface UserInfo {
        id: string;
        name: string;
        email?: string;
        picture?: string;
        [key: string]: any;
    }

    interface FriendsList {
        friends: UserInfo[];
    }

    // Client Type
    interface FCAClientOptions {
        useEnhancedDomains?: boolean;
        messageCacheEnabled?: boolean;
        messageCacheTTL?: number;
        threadCacheEnabled?: boolean;
        threadCacheTTL?: number;
        userCacheEnabled?: boolean;
        userCacheTTL?: number;
        accountCacheEnabled?: boolean;
        accountCacheTTL?: number;
        realtimeCacheEnabled?: boolean;
        realtimeCacheTTL?: number;
        [key: string]: any;
    }

    interface FCAClient {
        raw: any;
        domains?: DomainsManager;
        capabilities?: CapabilityResolver;
        realtimeManager?: MqttRealtimeManager;
        messages: MessagesDomain;
        threads: ThreadsDomain;
        users: UsersDomain;
        account: AccountDomain;
        realtime: RealtimeDomain;
        http?: { get?: Function; post?: Function; postFormData?: Function };
        scheduler?: { schedule?: Function };
        useMiddleware?: (fn: (context: any, next: () => Promise<void>, domain: Domain) => Promise<void>) => FCAClient;
        useDomainMiddleware?: (domain: string, fn: (context: any, next: () => Promise<void>) => Promise<void>) => FCAClient;
        clearCache?: () => FCAClient;
        getStatus?: () => DomainsStatus;
        getAvailableMethods?: () => AvailableMethods;
    }

    // Base Domain Class
    class Domain {
        api: any;
        name: string;
        options: DomainOptions;
        middleware: Array<(context: any, next: () => Promise<void>, domain: Domain) => Promise<void>>;
        cache: Map<string, { value: any; timestamp: number }>;
        cacheEnabled: boolean;
        cacheTTL: number;

        constructor(api: any, name: string, options?: DomainOptions);
        use(fn: (context: any, next: () => Promise<void>, domain: Domain) => Promise<void>): this;
        executeMiddleware(context: any, operation: string): Promise<void>;
        getCached(key: string): any | null;
        setCached(key: string, value: any): void;
        clearCache(pattern?: string | null): void;
        getCacheStats(): CacheStats;
    }

    // Domains Factory Class
    class DomainFactory {
        api: any;
        options: DomainOptions;
        domains: Map<string, Domain>;

        constructor(api: any, options?: DomainOptions);
        create(name: string, domainClass: any, options?: DomainOptions): Domain;
        get(name: string): Domain | undefined;
        getAll(): Domain[];
        clearAllCaches(): void;
    }

    // Domains Manager Class
    class DomainsManager {
        api: any;
        options: DomainsManagerOptions;
        factory: DomainFactory;
        messages: MessagesDomain;
        threads: ThreadsDomain;
        users: UsersDomain;
        account: AccountDomain;
        realtime: RealtimeDomain;

        constructor(api: any, options?: DomainsManagerOptions);
        initializeDomains(): void;
        useMiddleware(fn: (context: any, next: () => Promise<void>, domain: Domain) => Promise<void>): this;
        useDomainMiddleware(domainName: string, fn: (context: any, next: () => Promise<void>) => Promise<void>): this;
        clearAllCaches(): this;
        clearDomainCache(domainName: string, pattern?: string | null): this;
        getStatus(): DomainsStatus;
        getAvailableMethods(): AvailableMethods;
    }

    // Error Handler Classes
    class FCAError extends Error {
        code: string;
        details: Record<string, any>;

        constructor(message: string, code?: string, details?: Record<string, any>);
    }

    class RetryHandler {
        maxRetries: number;
        baseDelay: number;
        maxDelay: number;
        backoffMultiplier: number;
        jitter: boolean;

        constructor(options?: RetryHandlerOptions);
        execute<T>(fn: () => Promise<T>, context?: any): Promise<T>;
        calculateDelay(attempt: number): number;
        isPermanentError(error: any): boolean;
    }

    class ErrorTracker {
        errors: ErrorEntry[];
        maxErrors: number;

        constructor();
        track(error: Error, context?: Record<string, any>): ErrorEntry;
        getErrors(filter?: { code?: string; since?: Date }): ErrorEntry[];
        clear(): void;
        getStats(): ErrorStats;
    }

    // MQTT Realtime Manager Class
    class MqttRealtimeManager extends EventEmitter {
        options: MqttRealtimeManagerOptions;
        state: string;
        retryHandler: RetryHandler;
        mqtt: any;
        seqId: string | null;
        seqIdTimestamp: number | null;
        listeners: Map<string, { topic: string; qos: number; granted: any }>;

        constructor(options?: MqttRealtimeManagerOptions);
        connect(mqttClient: any, getSeqIdFn: () => Promise<string>): Promise<this>;
        disconnect(): Promise<void>;
        subscribe(topic: string, options?: { qos?: number }): Promise<any>;
        publish(topic: string, message: string | Buffer, options?: { qos?: number }): Promise<void>;
        refreshSeqId(getSeqIdFn: () => Promise<string>): Promise<string>;
        startSeqIdRefresh(getSeqIdFn: () => Promise<string>): void;
        isSeqIdStale(): boolean;
        getState(): MqttRealtimeState;
        setState(newState: string): void;
        clearTimers(): void;
        clearSeqIdRefreshTimer(): void;
    }

    // Capability Resolver Class
    class CapabilityResolver {
        capabilities: Map<string, CapabilityMetadata>;
        featureFlags: Map<string, boolean>;
        supportedLocales: string[];
        currentLocale: string;
        clientVersion: string;

        constructor(options?: CapabilityResolverOptions);
        initializeCapabilities(): void;
        setCapability(name: string, enabled: boolean, metadata?: Record<string, any>): void;
        hasCapability(name: string): boolean;
        getCapability(name: string): CapabilityMetadata | undefined;
        setFeature(name: string, enabled: boolean): void;
        isFeatureEnabled(name: string): boolean;
        getAllCapabilities(): Record<string, CapabilityMetadata>;
        getEnabledCapabilities(): string[];
        getCapabilitiesByNamespace(namespace: string): Record<string, CapabilityMetadata>;
        getStatus(): CapabilityStatus;
        setCapabilities(capabilityMap: Record<string, boolean | { enabled: boolean; metadata?: Record<string, any> }>): void;
        setLocale(locale: string): void;
        requires(...capabilities: string[]): boolean;
    }

    // Messages Domain Class
    class MessagesDomain extends Domain {
        send(payload: SendMessageOptions, threadID: string, callback?: Function): Promise<any>;
        edit(messageID: string, newText: string, callback?: Function): Promise<any>;
        unsend(messageID: string, callback?: Function): Promise<any>;
        delete(messageID: string, callback?: Function): Promise<any>;
        get(messageID: string, callback?: Function): Promise<any>;
        setReaction(messageID: string, reaction: string, callback?: Function): Promise<any>;
        sendTyping(threadID: string, isTyping: boolean, callback?: Function): Promise<any>;
        markAsRead(threadID: string, callback?: Function): Promise<any>;
        markAsDelivered(threadID: string, messageID: string, callback?: Function): Promise<any>;
        markAsSeen(threadID: string, callback?: Function): Promise<any>;
        forward(messageID: string, threadID: string, callback?: Function): Promise<any>;
        uploadAttachment(filePath: string, callback?: Function): Promise<any>;
        getEmojiUrl(pack: string, id: string, callback?: Function): Promise<string>;
        resolvePhotoUrl(photoUrl: string, callback?: Function): Promise<string>;
    }

    // Threads Domain Class
    class ThreadsDomain extends Domain {
        getInfo(threadID: string, callback?: Function): Promise<ThreadInfo>;
        getList(limit?: number, timestamp?: number, callback?: Function): Promise<ThreadList>;
        getHistory(threadID: string, amount?: number, timestamp?: number, callback?: Function): Promise<MessageHistory>;
        getPictures(threadID: string, callback?: Function): Promise<any[]>;
        create(participantIds: string[], title: string, callback?: Function): Promise<any>;
        addUser(userID: string, threadID: string, callback?: Function): Promise<any>;
        removeUser(userID: string, threadID: string, callback?: Function): Promise<any>;
        changeAdmin(userID: string, threadID: string, admin: boolean, callback?: Function): Promise<any>;
        changeColor(color: string, threadID: string, callback?: Function): Promise<any>;
        changeEmoji(emoji: string, threadID: string, callback?: Function): Promise<any>;
        setTitle(title: string, threadID: string, callback?: Function): Promise<any>;
        changeImage(imagePath: string, threadID: string, callback?: Function): Promise<any>;
        search(searchQuery: string, callback?: Function): Promise<ThreadList>;
        mute(threadID: string, muteSeconds: number, callback?: Function): Promise<any>;
    }

    // Users Domain Class
    class UsersDomain extends Domain {
        getInfo(userID: string, callback?: Function): Promise<UserInfo>;
        getInfoV2(userID: string, callback?: Function): Promise<UserInfo>;
        getUserID(email: string, callback?: Function): Promise<string>;
        getFriendsList(callback?: Function): Promise<FriendsList>;
        handleFriendRequest(userID: string, accept: boolean, callback?: Function): Promise<any>;
        unfriend(userID: string, callback?: Function): Promise<any>;
        changeBlockedStatus(userID: string, blocked: boolean, callback?: Function): Promise<any>;
        setNickname(userID: string, nickname: string, threadID: string, callback?: Function): Promise<any>;
        follow(userID: string, callback?: Function): Promise<any>;
        getAccess(userID: string, callback?: Function): Promise<any>;
    }

    // Account Domain Class
    class AccountDomain extends Domain {
        changeAvatar(imagePath: string, callback?: Function): Promise<any>;
        changeBio(bio: string, callback?: Function): Promise<any>;
        getBotInfo(userID: string, callback?: Function): Promise<any>;
        getBotInitialData(callback?: Function): Promise<any>;
        logout(callback?: Function): Promise<any>;
        handleMessageRequest(userID: string, accept: boolean, callback?: Function): Promise<any>;
        addExternalModule(path: string, callback?: Function): Promise<any>;
        enableAutoSaveAppState(path: string, interval: number, callback?: Function): Promise<any>;
    }

    // Realtime Domain Class
    class RealtimeDomain extends Domain {
        listeners: Map<string, Function[]>;
        listen(onUpdateCallback: Function, onErrorCallback?: Function): Promise<any>;
        listenSpeed(onUpdateCallback: Function, onErrorCallback?: Function): Promise<any>;
        broadcast(message: any, threadIDs: string[], callback?: Function): Promise<any>;
        sendMessageMqtt(payload: any, threadID: string, callback?: Function): Promise<any>;
        setMessageReactionMqtt(messageID: string, reaction: string, callback?: Function): Promise<any>;
        setThreadThemeMqtt(themeID: string, threadID: string, callback?: Function): Promise<any>;
        getMqttDeltaValue(key: string, callback?: Function): Promise<any>;
        on(eventName: string, callback: Function): this;
        once(eventName: string, callback: Function): this;
        off(eventName: string, callback: Function): this;
        emit(eventName: string, ...args: any[]): this;
        listenerCount(eventName: string): number;
        getStatus(): any;
    }

    // Factory Functions
    function createFcaClient(api: any, options?: FCAClientOptions): FCAClient;
    function attachClientFacade(api: any, options?: FCAClientOptions): FCAClient;
    function createMessagesDomain(api: any, options?: DomainOptions): MessagesDomain;
    function createThreadsDomain(api: any, options?: DomainOptions): ThreadsDomain;
    function createUsersDomain(api: any, options?: DomainOptions): UsersDomain;
    function createAccountDomain(api: any, options?: DomainOptions): AccountDomain;
    function createRealtimeDomain(api: any, options?: DomainOptions): RealtimeDomain;
    function createHttpDomain(api: any): any;
    function createSchedulerDomain(api: any): any;
}

export = MetaChat;
