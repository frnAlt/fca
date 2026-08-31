"use strict";

const url = require("url");
const querystring = require("querystring");
const { getType } = require("../../constants");

function getExtension(original_extension, fullFileName = "") {
    if (original_extension) {
        return original_extension;
    } else {
        const extension = fullFileName.split(".").pop();
        return (extension === fullFileName) ? "" : extension;
    }
}

function _formatAttachment(attachment1, attachment2) {
    const blob_attachment = attachment1.mercury || attachment1.blob_attachment || attachment1.sticker_attachment;
    let type_attachment = blob_attachment && blob_attachment.__typename ? blob_attachment.__typename : attachment1.attach_type;

    if (type_attachment == null && attachment1.id != null && attachment1.extensible_attachment == null) {
        return {
            type: "share",
            ID: attachment1.id,
            url: attachment1.href,
            title: "Shared Content",
            description: "Unsupported shared content.",
            source: null,
            isUnrecognized: true
        };
    }
    
    if (!attachment1.attach_type && attachment1.imageMetadata) {
        return {
            type: 'photo',
            ID: attachment1.fbid,
            filename: attachment1.filename,
            fileSize: Number(attachment1.fileSize || 0),
            mimeType: attachment1.mimeType,
            width: attachment1.imageMetadata.width,
            height: attachment1.imageMetadata.height,
            url: null,
            thumbnailUrl: null,
            previewUrl: null,
            largePreviewUrl: null,
            name: attachment1.filename
        };
    }

    attachment2 = attachment2 || { id: "", image_data: {} };
    attachment1 = attachment1.mercury || attachment1;
    let blob = attachment1.blob_attachment || attachment1.sticker_attachment;
    let type = blob && blob.__typename ? blob.__typename : attachment1.attach_type;

    if (!type && attachment1.sticker_attachment) {
        type = "StickerAttachment";
        blob = attachment1.sticker_attachment;
    } else if (!type && attachment1.extensible_attachment) {
        if (attachment1.extensible_attachment.story_attachment?.target?.__typename === "MessageLocation") {
            type = "MessageLocation";
        } else {
            type = "ExtensibleAttachment";
        }
        blob = attachment1.extensible_attachment;
    }

    switch (type) {
        case "sticker":
            return {
                type: "sticker",
                ID: attachment1.metadata?.stickerID?.toString() || "",
                url: attachment1.url || null,
                packID: attachment1.metadata?.packID?.toString() || "",
                spriteUrl: attachment1.metadata?.spriteURI || null,
                spriteUrl2x: attachment1.metadata?.spriteURI2x || null,
                width: attachment1.metadata?.width || 0,
                height: attachment1.metadata?.height || 0,
                caption: attachment2?.caption || null,
                description: attachment2?.description || null,
                frameCount: attachment1.metadata?.frameCount || 0,
                frameRate: attachment1.metadata?.frameRate || 0,
                framesPerRow: attachment1.metadata?.framesPerRow || 0,
                framesPerCol: attachment1.metadata?.framesPerCol || 0,
                stickerID: attachment1.metadata?.stickerID?.toString() || "",
                spriteURI: attachment1.metadata?.spriteURI || null,
                spriteURI2x: attachment1.metadata?.spriteURI2x || null
            };
        case "file":
            return {
                type: "file",
                filename: attachment1.name || "",
                ID: attachment2?.id?.toString() || "",
                url: attachment1.url || null,
                isMalicious: attachment2?.is_malicious || false,
                contentType: attachment2?.mime_type || "",
                name: attachment1.name || "",
                mimeType: attachment2?.mime_type || "",
                fileSize: attachment2?.file_size || 0
            };
        case "photo":
            const dimensions = attachment1.metadata?.dimensions?.split(",") || ["0", "0"];
            return {
                type: "photo",
                ID: attachment1.metadata?.fbid?.toString() || "",
                filename: attachment1.fileName || "",
                thumbnailUrl: attachment1.thumbnail_url || null,
                previewUrl: attachment1.preview_url || null,
                previewWidth: attachment1.preview_width || 0,
                previewHeight: attachment1.preview_height || 0,
                largePreviewUrl: attachment1.large_preview_url || null,
                largePreviewWidth: attachment1.large_preview_width || 0,
                largePreviewHeight: attachment1.large_preview_height || 0,
                url: attachment1.metadata?.url || null,
                width: dimensions[0] || "0",
                height: dimensions[1] || "0",
                name: attachment1.fileName || ""
            };
        case "animated_image":
            return {
                type: "animated_image",
                ID: attachment2?.id?.toString() || "",
                filename: attachment2?.filename || "",
                previewUrl: attachment1?.preview_url || null,
                previewWidth: attachment1?.preview_width || 0,
                previewHeight: attachment1?.preview_height || 0,
                url: attachment2?.image_data?.url || null,
                width: attachment2?.image_data?.width || 0,
                height: attachment2?.image_data?.height || 0,
                name: attachment1?.name || "",
                facebookUrl: attachment1?.url || null,
                thumbnailUrl: attachment1?.thumbnail_url || null,
                mimeType: attachment2?.mime_type || "",
                rawGifImage: attachment2?.image_data?.raw_gif_image || null,
                rawWebpImage: attachment2?.image_data?.raw_webp_image || null,
                animatedGifUrl: attachment2?.image_data?.animated_gif_url || null,
                animatedGifPreviewUrl: attachment2?.image_data?.animated_gif_preview_url || null,
                animatedWebpUrl: attachment2?.image_data?.animated_webp_url || null,
                animatedWebpPreviewUrl: attachment2?.image_data?.animated_webp_preview_url || null
            };
        case "share":
            return {
                type: "share",
                ID: attachment1.share?.share_id?.toString() || "",
                url: attachment2?.href || null,
                title: attachment1.share?.title || null,
                description: attachment1.share?.description || null,
                source: attachment1.share?.source || null,
                image: attachment1.share?.media?.image || null,
                width: attachment1.share?.media?.image_size?.width || null,
                height: attachment1.share?.media?.image_size?.height || null,
                playable: attachment1.share?.media?.playable || false,
                duration: attachment1.share?.media?.duration || 0,
                subattachments: attachment1.share?.subattachments || [],
                properties: {},
                animatedImageSize: attachment1.share?.media?.animated_image_size || null,
                facebookUrl: attachment1.share?.uri || null,
                target: attachment1.share?.target || null,
                styleList: attachment1.share?.style_list || null
            };
        case "video":
            return {
                type: "video",
                ID: attachment1.metadata?.fbid?.toString() || "",
                filename: attachment1.name || "",
                previewUrl: attachment1.preview_url || null,
                previewWidth: attachment1.preview_width || 0,
                previewHeight: attachment1.preview_height || 0,
                url: attachment1.url || null,
                width: attachment1.metadata?.dimensions?.width || 0,
                height: attachment1.metadata?.dimensions?.height || 0,
                duration: attachment1.metadata?.duration || 0,
                videoType: "unknown",
                thumbnailUrl: attachment1.thumbnail_url || null
            };
        case "error":
            return {
                type: "error",
                attachment1: attachment1,
                attachment2: attachment2
            };
        case "MessageImage": {
            // Guard nested objects — Facebook occasionally returns MessageImage with
            // missing preview/thumbnail/large_preview/original_dimensions objects,
            // which causes a crash on property access (e.g. blob.preview.uri).
            const imgThumb = blob.thumbnail || {};
            const imgPrev = blob.preview || {};
            const imgLarge = blob.large_preview || {};
            const imgDims = blob.original_dimensions || {};
            return {
                type: "photo",
                ID: blob.legacy_attachment_id,
                filename: blob.filename,
                thumbnailUrl: imgThumb.uri || null,
                previewUrl: imgPrev.uri || null,
                previewWidth: imgPrev.width || 0,
                previewHeight: imgPrev.height || 0,
                largePreviewUrl: imgLarge.uri || null,
                largePreviewWidth: imgLarge.width || 0,
                largePreviewHeight: imgLarge.height || 0,
                url: imgLarge.uri || null,
                width: imgDims.x || 0,
                height: imgDims.y || 0,
                name: blob.filename
            };
        }
        case "MessageAnimatedImage": {
            const aniPrev = blob.preview_image || {};
            const aniImg = blob.animated_image || {};
            return {
                type: "animated_image",
                ID: blob.legacy_attachment_id,
                filename: blob.filename,
                previewUrl: aniPrev.uri || null,
                previewWidth: aniPrev.width || 0,
                previewHeight: aniPrev.height || 0,
                url: aniImg.uri || null,
                width: aniImg.width || 0,
                height: aniImg.height || 0,
                thumbnailUrl: aniPrev.uri || null,
                name: blob.filename,
                facebookUrl: aniImg.uri || null,
                rawGifImage: aniImg.uri || null,
                animatedGifUrl: aniImg.uri || null,
                animatedGifPreviewUrl: aniPrev.uri || null,
                animatedWebpUrl: aniImg.uri || null,
                animatedWebpPreviewUrl: aniPrev.uri || null
            };
        }
        case "MessageVideo": {
            const vidImg = blob.large_image || {};
            const vidDims = blob.original_dimensions || {};
            return {
                type: "video",
                filename: blob.filename,
                ID: blob.legacy_attachment_id,
                previewUrl: vidImg.uri || null,
                previewWidth: vidImg.width || 0,
                previewHeight: vidImg.height || 0,
                url: blob.playable_url || null,
                width: vidDims.x || 0,
                height: vidDims.y || 0,
                duration: blob.playable_duration_in_ms || 0,
                videoType: blob.video_type ? blob.video_type.toLowerCase() : "unknown",
                thumbnailUrl: vidImg.uri || null
            };
        }
        case "MessageFile":
            return {
                type: "file",
                filename: blob.filename,
                ID: blob.message_file_fbid,
                url: blob.url,
                isMalicious: blob.is_malicious,
                contentType: blob.content_type,
                name: blob.filename,
                mimeType: blob.content_type || "",
                fileSize: -1
            };
        case "MessageAudio":
            return {
                type: "audio",
                filename: blob.filename,
                ID: blob.url_shimhash,
                audioType: blob.audio_type,
                duration: blob.playable_duration_in_ms,
                url: blob.playable_url,
                isVoiceMail: blob.is_voicemail
            };
        case "Sticker":
        case "StickerAttachment":
            return {
                type: "sticker",
                ID: blob.id,
                url: blob.url,
                packID: blob.pack ? blob.pack.id : null,
                spriteUrl: blob.sprite_image,
                spriteUrl2x: blob.sprite_image_2x,
                width: blob.width,
                height: blob.height,
                caption: blob.label,
                description: blob.label,
                frameCount: blob.frame_count,
                frameRate: blob.frame_rate,
                framesPerRow: blob.frames_per_row,
                framesPerCol: blob.frames_per_column,
                stickerID: blob.id,
                spriteURI: blob.sprite_image,
                spriteURI2x: blob.sprite_image_2x
            };
        case "MessageLocation":
            const urlAttach = blob.story_attachment.url;
            const mediaAttach = blob.story_attachment.media;
            
            let u, where1, address, latitude, longitude, imageUrl, width, height;
            
            try {
                u = querystring.parse(url.parse(urlAttach).query).u;
                where1 = querystring.parse(url.parse(u).query).where1;
                address = where1.split(", ");
                latitude = Number.parseFloat(address[0]);
                longitude = Number.parseFloat(address[1]);
            } catch (err) {
                latitude = undefined;
                longitude = undefined;
            }
            
            if (mediaAttach && mediaAttach.image) {
                imageUrl = mediaAttach.image.uri;
                width = mediaAttach.image.width;
                height = mediaAttach.image.height;
            }
            
            return {
                type: "location",
                ID: blob.legacy_attachment_id,
                latitude: latitude,
                longitude: longitude,
                image: imageUrl,
                width: width,
                height: height,
                url: u || urlAttach,
                address: where1,
                facebookUrl: blob.story_attachment.url,
                target: blob.story_attachment.target,
                styleList: blob.story_attachment.style_list
            };
        case "ExtensibleAttachment":
            const story = blob.story_attachment;
            return {
                type: "share",
                ID: blob.legacy_attachment_id,
                url: story?.url || null,
                title: story?.title_with_entities?.text || null,
                description: story?.description?.text || null,
                source: story?.source?.text || null,
                image: story?.media?.image?.uri || null,
                width: story?.media?.image?.width || null,
                height: story?.media?.image?.height || null,
                playable: story?.media?.is_playable || false,
                duration: story?.media?.playable_duration_in_ms || 0,
                playableUrl: story?.media?.playable_url || null,
                subattachments: story?.subattachments || [],
                properties: (story?.properties || []).reduce((obj, cur) => {
                    if (cur && cur.key && cur.value) {
                        obj[cur.key] = cur.value.text || cur.value;
                    }
                    return obj;
                }, {}),
                facebookUrl: story?.url || null,
                target: story?.target || null,
                styleList: story?.style_list || null
            };
        default:
            try {
                throw new Error(
                    "Unrecognized attachment type: " + type +
                    "\nattachment1: " + JSON.stringify(attachment1, null, 2) +
                    "\nattachment2: " + JSON.stringify(attachment2, null, 2)
                );
            } catch (err) {
                return {
                    type: "unknown",
                    error: err.message,
                    rawAttachment1: attachment1,
                    rawAttachment2: attachment2
                };
            }
    }
}

function formatAttachment(attachments, attachmentIds, attachmentMap, shareMap) {
    attachmentMap = shareMap || attachmentMap;
    return attachments ?
        attachments.map((val, i) => {
            if (!attachmentMap || !attachmentIds || !attachmentMap[attachmentIds[i]]) {
                return _formatAttachment(val);
            }
            return _formatAttachment(val, attachmentMap[attachmentIds[i]]);
        }) : [];
}

module.exports = {
    _formatAttachment,
    formatAttachment
};