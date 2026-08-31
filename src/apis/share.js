"use strict";

const utils = require('../utils');

function formatPreviewResult(data) {
    if (data.errors) {
        throw data.errors[0];
    }
    const previewData = data.data?.xma_preview_data;
    if (!previewData) {
        throw { error: "Could not generate a preview for this post." };
    }
    return {
        postID: previewData.post_id,
        header: previewData.header_title,
        subtitle: previewData.subtitle_text,
        title: previewData.title_text,
        previewImage: previewData.preview_url,
        favicon: previewData.favicon_url,
        headerImage: previewData.header_image_url
    };
}

module.exports = function(defaultFuncs, api, ctx) {
    return async function getPostPreview(postID, callback) {
        let resolveFunc, rejectFunc;
        const returnPromise = new Promise((resolve, reject) => {
            resolveFunc = resolve;
            rejectFunc = reject;
        });
        
        const cb = (err, data) => {
            if (callback) callback(err, data);
            if (err) return rejectFunc(err);
            resolveFunc(data);
        };
        if (!postID) {
            cb({ error: "A postID is required to generate a preview." });
            return returnPromise;
        }

        const variables = {
            shareable_id: postID.toString(),
            scale: 3,
        };

        // Use configurable doc_id or default (may be outdated)
        // To update: 
        // 1. Open Facebook Messenger in browser
        // 2. Open DevTools (F12) → Network tab → Filter by "graphql"
        // 3. Trigger a share/preview action
        // 4. Look for CometXMAProxyShareablePreviewQuery request
        // 5. Copy the doc_id value from the request payload
        // 6. Set ctx.options.sharePreviewDocId = 'NEW_DOC_ID' when logging in
        //
        // Known doc_ids (may expire):
        // - 28939050904374351 (expired as of Nov 2024)
        const docId = ctx.options?.sharePreviewDocId || '28939050904374351';

        const form = {
            fb_api_caller_class: 'RelayModern',
            fb_api_req_friendly_name: 'CometXMAProxyShareablePreviewQuery',
            variables: JSON.stringify(variables),
            doc_id: docId
        };

        try {
            const resData = await defaultFuncs
                .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
                .then(utils.parseAndCheckLogin(ctx, defaultFuncs));
            
            // Check for persisted query not found error (case-insensitive)
            if (resData?.errors) {
                const persistedQueryError = resData.errors.find(e => {
                    const msg = (e.message || '').toLowerCase();
                    return msg.includes('persistedquerynotfound') || 
                           msg.includes('document') && msg.includes('not found') ||
                           msg.includes('persisted query');
                });
                if (persistedQueryError) {
                    const error = {
                        error: "Facebook GraphQL doc_id expired. Please update ctx.options.sharePreviewDocId",
                        details: "Capture the current doc_id from Messenger web traffic (inspect CometXMAProxyShareablePreviewQuery request)",
                        currentDocId: docId,
                        fbError: persistedQueryError.message
                    };
                    utils.error("getPostPreview", error);
                    cb(error);
                    return returnPromise;
                }
            }
            
            const result = formatPreviewResult(resData);
            cb(null, result);
            return returnPromise;
        } catch (err) {
            // Add helpful context for common failure modes
            if (err.message?.includes('UNHANDLED_REJECTION') || err.message?.includes('not found')) {
                err.hint = "The GraphQL doc_id may be outdated. Set ctx.options.sharePreviewDocId with current value from Messenger traffic.";
            }
            utils.error("getPostPreview", err);
            cb(err);
            return returnPromise;
        }
    };
};
