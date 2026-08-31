"use strict";

const utils = require('../utils');

module.exports = (defaultFuncs, api, ctx) => {
  return async function searchForThread(searchQuery, callback) {
    let resolveFunc = () => {};
    let rejectFunc = () => {};
    const returnPromise = new Promise((resolve, reject) => {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    // Store original callback if provided
    const originalCallback = callback;
    
    // Always use a wrapped callback that settles the promise
    callback = (err, result) => {
      if (originalCallback) {
        originalCallback(err, result);
      }
      if (err) return rejectFunc(err);
      resolveFunc(result);
    };

    if (!searchQuery || typeof searchQuery !== 'string') {
      const error = { error: "searchForThread: searchQuery parameter must be a non-empty string" };
      utils.error("searchForThread", error);
      callback(error);
      return returnPromise;
    }

    try {
      // Strategy 1: Use GraphQL-based getThreadList and filter locally
      // This bypasses checkpoint issues entirely
      utils.log("searchForThread", "Using GraphQL-based search (bypasses checkpoints)");
      
      try {
        // Use getThreadList to fetch threads from INBOX
        // This ensures consistent behavior and avoids tag parameter issues
        const threads = await api.getThreadList(100, null, ["INBOX"]);
        
        if (!threads || threads.length === 0) {
          utils.warn("searchForThread", "No threads available in INBOX, trying legacy method");
          throw new Error("No threads available from GraphQL");
        }

        utils.log("searchForThread", `Retrieved ${threads.length} threads from GraphQL`);

        // Filter threads by search query (case-insensitive, partial match)
        const searchLower = searchQuery.toLowerCase().trim();
        const matchedThreads = threads.filter(thread => {
          // Search in thread name
          if (thread.threadName && thread.threadName.toLowerCase().includes(searchLower)) {
            return true;
          }
          
          // Search in thread ID (exact or partial match)
          if (thread.threadID && thread.threadID.toString().includes(searchQuery)) {
            return true;
          }
          
          // Search in participant names
          if (thread.userInfo && Array.isArray(thread.userInfo)) {
            return thread.userInfo.some(user => 
              user.name && user.name.toLowerCase().includes(searchLower)
            );
          }
          
          return false;
        });

        if (matchedThreads.length === 0) {
          callback({ 
            error: `Could not find thread matching "${searchQuery}".`,
            details: "No threads match your search query. Try a different search term."
          });
          return returnPromise;
        }

        utils.log("searchForThread", `Found ${matchedThreads.length} matching thread(s) using GraphQL method`);
        callback(null, matchedThreads);
        return returnPromise;
        
      } catch (graphqlError) {
        utils.warn("searchForThread", "GraphQL method failed, falling back to legacy AJAX endpoint");
        utils.error("searchForThread GraphQL error", graphqlError);
        
        // Strategy 2: Fallback to legacy AJAX endpoint (may trigger checkpoints)
        const form = {
          client: "web_messenger",
          query: searchQuery,
          offset: 0,
          limit: 21,
          index: "fbid"
        };

        const res = await defaultFuncs.post(
          "https://www.facebook.com/ajax/mercury/search_threads.php",
          ctx.jar,
          form
        ).then(utils.parseAndCheckLogin(ctx, defaultFuncs));

        if (!res) {
          const error = { 
            error: "Account checkpoint required - searchForThread is restricted until verification",
            details: "Please verify your account on facebook.com. This function requires additional permissions.",
            errorCode: 1357004,
            errorType: 'CHECKPOINT'
          };
          callback(error);
          return returnPromise;
        }

        if (res.error) {
          throw new Error(res.error_msg || res.errorSummary || String(res.error));
        }

        // Support both legacy payload.threads (object map) and newer payload.mercury_payload.threads (array)
        let threadsData = res.payload?.mercury_payload?.threads || res.payload?.threads;
        
        if (!threadsData) {
          callback({ 
            error: `Could not find thread "${searchQuery}".`,
            details: "The thread may not exist or access may be restricted."
          });
          return returnPromise;
        }

        // Convert legacy object format to array if needed
        if (!Array.isArray(threadsData)) {
          threadsData = Object.values(threadsData);
        }

        const threads = threadsData.map(utils.formatThread);
        utils.log("searchForThread", `Found ${threads.length} thread(s) using legacy AJAX method`);
        callback(null, threads);
      }
    } catch (err) {
      // Enhanced error handling for checkpoint errors
      if (err.errorCode === 1357004 || err.errorType === 'CHECKPOINT') {
        err.error = "Account checkpoint required - searchForThread is restricted until verification";
        err.friendlyMessage = "Your account requires verification on facebook.com before using search features";
      } else if (err.error && typeof err.error === 'string' && err.error.includes('checkpoint')) {
        err.friendlyMessage = "Account checkpoint required - searchForThread is restricted until verification";
      }
      
      utils.error("searchForThread", err);
      callback(err);
    }

    return returnPromise;
  };
};
