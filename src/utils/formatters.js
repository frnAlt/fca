/* eslint-disable no-prototype-builtins */
"use strict";/*mention fixed by Fahad*/
const url = require("url");

const querystring = require("querystring");

const stream = require("stream");

const { getType, padZeros, NUM_TO_MONTH, NUM_TO_DAY } = require("./constants"); 
function isReadableStream(obj) {
 return obj instanceof stream.Stream && typeof obj._read == "function" && getType(obj._readableState) == "Object";
}

function getExtension(original_extension, fullFileName = "") {
    if (original_extension) {
        return original_extension;
    } else {
        const extension = fullFileName.split(".").pop();
        if (extension === fullFileName) {
            return "";
        } else {
            return extension;
        }
    }
}

/**
 * A function for formatting incoming attachments.
 * @param {Object} attachment1 - The main attachment object.
 * @param {Object} attachment2 - A secondary attachment object that sometimes contains additional data.
 * @returns {Object} A formatted attachment object.
 */
function _formatAttachment(attachment1, attachment2) {
  const blob_attachment = attachment1.mercury || attachment1.blob_attachment || attachment1.sticker_attachment;
   const type_attachment = blob_attachment && blob_attachment.__typename ? blob_attachment.__typename : attachment1.attach_type;
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


    attachment2 = attachment2 || {
        id: "",
        image_data: {}
    };
    attachment1 = attachment1.mercury || attachment1;
    let blob = attachment1.blob_attachment || attachment1.sticker_attachment;
    let type =
    blob && blob.__typename ? blob.__typename: attachment1.attach_type;
    if (!type && attachment1.sticker_attachment) {
        type = "StickerAttachment";
        blob = attachment1.sticker_attachment;
    } else if (!type && attachment1.extensible_attachment) {
        if (
            attachment1.extensible_attachment.story_attachment &&
            attachment1.extensible_attachment.story_attachment.target &&
            attachment1.extensible_attachment.story_attachment.target.__typename &&
            attachment1.extensible_attachment.story_attachment.target.__typename === "MessageLocation"
        ) {
            type = "MessageLocation";
        } else {
            type = "ExtensibleAttachment";
        }

        blob = attachment1.extensible_attachment;
    }

    const fullFileName = attachment1.filename;
    const fileSize = Number(attachment1.fileSize || 0);
    const durationVideo = attachment1.genericMetadata ? Number(attachment1.genericMetadata.videoLength): undefined;
    const durationAudio = attachment1.genericMetadata ? Number(attachment1.genericMetadata.duration): undefined;
    const mimeType = attachment1.mimeType;

    switch (type) {
        case "sticker":
            return {
                type: "sticker",
                ID: attachment1.metadata.stickerID.toString(),
                url: attachment1.url,
                packID: attachment1.metadata.packID.toString(),
                spriteUrl: attachment1.metadata.spriteURI,
                spriteUrl2x: attachment1.metadata.spriteURI2x,
                width: attachment1.metadata.width,
                height: attachment1.metadata.height,
                caption: attachment2.caption,
                description: attachment2.description,
                frameCount: attachment1.metadata.frameCount,
                frameRate: attachment1.metadata.frameRate,
                framesPerRow: attachment1.metadata.framesPerRow,
                framesPerCol: attachment1.metadata.framesPerCol,
                stickerID: attachment1.metadata.stickerID.toString(),
                spriteURI: attachment1.metadata.spriteURI,
                spriteURI2x: attachment1.metadata.spriteURI2x
            };
        case "file":
                return {
                    type: "file",
                    ID: attachment2.id.toString(),
                    fullFileName: fullFileName,
                    filename: attachment1.name,
                    fileSize: fileSize,
                    original_extension: getExtension(attachment1.original_extension, fullFileName),
                    mimeType: mimeType,
                    url: attachment1.url,
                    isMalicious: attachment2.is_malicious,
                    contentType: attachment2.mime_type,
                    name: attachment1.name
                };
        case "photo":
                    return {
                        type: "photo",
                        ID: attachment1.metadata.fbid.toString(),
                        filename: attachment1.fileName,
                        fullFileName: fullFileName,
                        fileSize: fileSize,
                        original_extension: getExtension(attachment1.original_extension, fullFileName),
                        mimeType: mimeType,
                        thumbnailUrl: attachment1.thumbnail_url,
                        previewUrl: attachment1.preview_url,
                        previewWidth: attachment1.preview_width,
                        previewHeight: attachment1.preview_height,
                        largePreviewUrl: attachment1.large_preview_url,
                        largePreviewWidth: attachment1.large_preview_width,
                        largePreviewHeight: attachment1.large_preview_height,
                        url: attachment1.metadata.url,
                        width: attachment1.metadata.dimensions.split(",")[0],
                        height: attachment1.metadata.dimensions.split(",")[1],
                        name: fullFileName
                    };
        case "animated_image":
                        return {
                            type: "animated_image",
                            ID: attachment2.id.toString(),
                            filename: attachment2.filename,
                            fullFileName: fullFileName,
                            original_extension: getExtension(attachment2.original_extension, fullFileName),
                            mimeType: mimeType,
                            previewUrl: attachment1.preview_url,
                            previewWidth: attachment1.preview_width,
                            previewHeight: attachment1.preview_height,
                            url: attachment2.image_data.url,
                            width: attachment2.image_data.width,
                            height: attachment2.image_data.height,
                            name: attachment1.name,
                            facebookUrl: attachment1.url,
                            thumbnailUrl: attachment1.thumbnail_url,
                            rawGifImage: attachment2.image_data.raw_gif_image,
                            rawWebpImage: attachment2.image_data.raw_webp_image,
                            animatedGifUrl: attachment2.image_data.animated_gif_url,
                            animatedGifPreviewUrl: attachment2.image_data.animated_gif_preview_url,
                            animatedWebpUrl: attachment2.image_data.animated_webp_url,
                            animatedWebpPreviewUrl: attachment2.image_data.animated_webp_preview_url
                        };
        case "share":
                            return {
                                type: "share",
                                ID: attachment1.share.share_id.toString(),
                                url: attachment2.href,
                                title: attachment1.share.title,
                                description: attachment1.share.description,
                                source: attachment1.share.source,
                                image: attachment1.share.media.image,
                                width: attachment1.share.media.image_slicewidth,
                                height: attachment1.share.media.image_size.height,
                                playable: attachment1.share.media.playable,
                                duration: attachment1.share.media.duration,
                                subattachments: attachment1.share.subattachments,
                                properties: {},
                                animatedImageSize: attachment1.share.media.animated_image_size,
                                facebookUrl: attachment1.share.uri,
                                target: attachment1.share.target,
                                styleList: attachment1.share.style_list
                            };
        case "video":
                                return {
                                    type: "video",
                                    ID: attachment1.metadata.fbid.toString(),
                                    filename: attachment1.name,
                                    fullFileName: fullFileName,
                                    original_extension: getExtension(attachment1.original_extension, fullFileName),
                                    mimeType: mimeType,
                                    duration: durationVideo,
                                    previewUrl: attachment1.preview_url,
                                    previewWidth: attachment1.preview_width,
                                    previewHeight: attachment1.preview_height,
                                    url: attachment1.url,
                                    width: attachment1.metadata.dimensions.width,
                                    height: attachment1.metadata.dimensions.height,
                                    videoType: "unknown",
                                    thumbnailUrl: attachment1.thumbnail_url
                                };
        case "error":
                                    return {
                                        type: "error",
                                        attachment1: attachment1,
                                        attachment2: attachment2
                                    };
        case "MessageImage":
                                        return {
                                            type: "photo",
                                            ID: blob.legacy_attachment_id,
                                            filename: blob.filename,
                                            fullFileName: fullFileName,
                                            fileSize: fileSize,
                                            original_extension: getExtension(blob.original_extension, fullFileName),
                                            mimeType: mimeType,
                                            thumbnailUrl: blob.thumbnail.uri,
                                            previewUrl: blob.preview.uri,
                                            previewWidth: blob.preview.width,
                                            previewHeight: blob.preview.height,
                                            largePreviewUrl: blob.large_preview.uri,
                                            largePreviewWidth: blob.large_preview.width,
                                            largePreviewHeight: blob.large_preview.height,
                                            url: blob.large_preview.uri,
                                            width: blob.original_dimensions.x,
                                            height: blob.original_dimensions.y,
                                            name: blob.filename
                                        };
        case "MessageAnimatedImage":
                                            return {
                                                type: "animated_image",
                                                ID: blob.legacy_attachment_id,
                                                filename: blob.filename,
                                                fullFileName: fullFileName,
                                                original_extension: getExtension(blob.original_extension, fullFileName),
                                                mimeType: mimeType,
                                                previewUrl: blob.preview_image.uri,
                                                previewWidth: blob.preview_image.width,
                                                previewHeight: blob.preview_image.height,
                                                url: blob.animated_image.uri,
                                                width: blob.animated_image.width,
                                                height: blob.animated_image.height,
                                                thumbnailUrl: blob.preview_image.uri,
                                                name: blob.filename,
                                                facebookUrl: blob.animated_image.uri,
                                                rawGifImage: blob.animated_image.uri,
                                                animatedGifUrl: blob.animated_image.uri,
                                                animatedGifPreviewUrl: blob.preview_image.uri,
                                                animatedWebpUrl: blob.animated_image.uri,
                                                animatedWebpPreviewUrl: blob.preview_image.uri
                                            };
        case "MessageVideo":
                                                return {
                                                    type: "video",
                                                    ID: blob.legacy_attachment_id,
                                                    filename: blob.filename,
                                                    fullFileName: fullFileName,
                                                    original_extension: getExtension(blob.original_extension, fullFileName),
                                                    fileSize: fileSize,
                                                    duration: durationVideo,
                                                    mimeType: mimeType,
                                                    previewUrl: blob.large_image.uri,
                                                    previewWidth: blob.large_image.width,
                                                    previewHeight: blob.large_image.height,
                                                    url: blob.playable_url,
                                                    width: blob.original_dimensions.x,
                                                    height: blob.original_dimensions.y,
                                                    videoType: blob.video_type.toLowerCase(),
                                                    thumbnailUrl: blob.large_image.uri
                                                };
        case "MessageAudio":
                                                    return {
                                                        type: "audio",
                                                        ID: blob.url_shimhash,
                                                        filename: blob.filename,
                                                        fullFileName: fullFileName,
                                                        fileSize: fileSize,
                                                        duration: durationAudio,
                                                        original_extension: getExtension(blob.original_extension, fullFileName),
                                                        mimeType: mimeType,
                                                        audioType: blob.audio_type,
                                                        url: blob.playable_url,
                                                        isVoiceMail: blob.is_voicemail
                                                    };
        case "StickerAttachment":
        case "Sticker":
                                                    return {
                                                                type: "sticker",
                                                                ID: blob.id,
                                                                url: blob.url,
                                                                packID: blob.pack ? blob.pack.id: null,
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
                                                                var urlAttach = blob.story_attachment.url;
                                                                var mediaAttach = blob.story_attachment.media;

                                                                var u = querystring.parse(url.parse(urlAttach).query).u;
                                                                var where1 = querystring.parse(url.parse(u).query).where1;
                                                                var address = where1.split(", ");

                                                                var latitude;
                                                                var longitude;

                                                                try {
                                                                    latitude = Number.parseFloat(address[0]);
                                                                    longitude = Number.parseFloat(address[1]);
                                                                } catch (err) {
                                                                    /* empty */
                                                                }
                                                                var imageUrl;
                                                                var width;
                                                                var height;
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
                                                                    return {
                                                                        type: "share",
                                                                        ID: blob.legacy_attachment_id,
                                                                        url: blob.story_attachment.url,
                                                                        title: blob.story_attachment.title_with_entities.text,
                                                                        description:
                                                                            blob.story_attachment.description &&
                                                                            blob.story_attachment.description.text,
                                                                        source: blob.story_attachment.source ? blob.story_attachment.source.text: null,
                                                                        image:
                                                                            blob.story_attachment.media &&
                                                                            blob.story_attachment.media.image &&
                                                                            blob.story_attachment.media.image.uri,
                                                                        width:
                                                                            blob.story_attachment.media &&
                                                                            blob.story_attachment.media.image &&
                                                                            blob.story_attachment.media.image.width,
                                                                        height:
                                                                            blob.story_attachment.media &&
                                                                            blob.story_attachment.media.image &&
                                                                            blob.story_attachment.media.image.height,
                                                                        playable:
                                                                            blob.story_attachment.media &&
                                                                            blob.story_attachment.media.is_playable,
                                                                        duration:
                                                                            blob.story_attachment.media &&
                                                                            blob.story_attachment.media.playable_duration_in_ms,
                                                                        playableUrl:
                                                                            blob.story_attachment.media == null ? null:
                                                                            blob.story_attachment.media.playable_url,
                                                                        subattachments: blob.story_attachment.subattachments,
                                                                        properties: blob.story_attachment.properties.reduce(function(obj, cur) {
                                                                            obj[cur.key] = cur.value.text;
                                                                            return obj;
                                                                        }, {}),
                                                                        facebookUrl: blob.story_attachment.url,
                                                                        target: blob.story_attachment.target,
                                                                        styleList: blob.story_attachment.style_list
                                                                    };
        case "MessageFile":
                                                                        return {
                                                                            type: "file",
                                                                            ID: blob.message_file_fbid,
                                                                            fullFileName: fullFileName,
                                                                            filename: blob.filename,
                                                                            fileSize: fileSize,
                                                                            mimeType: blob.mimetype,
                                                                            original_extension: blob.original_extension || fullFileName.split(".").pop(),
                                                                            url: blob.url,
                                                                            isMalicious: blob.is_malicious,
                                                                            contentType: blob.content_type,
                                                                            name: blob.filename
                                                                        };
        default:
                                                                            throw new Error(
                                                                                "unrecognized attach_file of type " +
                                                                                type +
                                                                                "`" +
                                                                                JSON.stringify(attachment1, null, 4) +
                                                                                " attachment2: " +
                                                                                JSON.stringify(attachment2, null, 4) +
                                                                                "`"
                                                                            );
    }
}                                        function formatAttachment(attachments, attachmentIds, attachmentMap, shareMap) {
                                                                    attachmentMap = shareMap || attachmentMap;
                                                                    return attachments ?
                                                                    attachments.map(function(val, i) {
                                                                        if (
                                                                            !attachmentMap ||
                                                                            !attachmentIds ||
                                                                            !attachmentMap[attachmentIds[i]]
                                                                        ) {
                                                                            return _formatAttachment(val);
                                                                        }
                                                                        return _formatAttachment(val, attachmentMap[attachmentIds[i]]);
                                                                    }): [];
                                                            }

/**
 * Enhanced formatDeltaMessage with comprehensive mention parsing
 * Supports multiple Facebook mention formats (2024+)
 */
function formatDeltaMessage(m) {
    const md = m.delta.messageMetadata;
    const body = m.delta.body || "";
    let mdata = [];
    
    // NEW METHOD: messageMetadata.data.data.Gb.asMap.data (2025+ Facebook format)
    // This is the primary format Facebook uses now
    if (md?.data?.data) {
        try {
            const dataData = md.data.data;
            // Look for mention data in Gb key (or any key with asMap structure)
            for (const key of Object.keys(dataData)) {
                const entry = dataData[key];
                if (entry?.asMap?.data) {
                    const mapData = entry.asMap.data;
                    // Iterate through indexed entries (0, 1, 2, etc.)
                    for (const idx of Object.keys(mapData)) {
                        const mentionEntry = mapData[idx];
                        if (mentionEntry?.asMap?.data) {
                            const mentionData = mentionEntry.asMap.data;
                            // Extract id, offset, length from asLong wrappers
                            const id = mentionData.id?.asLong || mentionData.id?.asString;
                            const offset = parseInt(mentionData.offset?.asLong || mentionData.offset?.asString || '0', 10);
                            const length = parseInt(mentionData.length?.asLong || mentionData.length?.asString || '0', 10);
                            if (id) {
                                mdata.push({ i: id.toString(), o: offset, l: length });
                            }
                        }
                    }
                }
            }
        } catch (e) {
            utils.error('[MENTION PARSE ERROR] messageMetadata.data.data:', e.message);
        }
    }
    
    // Method 1: data.prng (old format - stringified JSON array)
    if (mdata.length === 0 && m.delta.data?.prng) {
        try {
            const parsed = JSON.parse(m.delta.data.prng);
            if (Array.isArray(parsed)) {
                mdata = parsed.map(item => ({
                    i: item.i || item.id || item.user_id,
                    o: item.o ?? item.offset ?? 0,
                    l: item.l ?? item.length ?? 0
                }));
            }
        } catch (e) {}
    }
    
    // Method 2: data.mentions (newer format - stringified JSON)
    if (mdata.length === 0 && m.delta.data?.mentions) {
        try {
            const parsed = JSON.parse(m.delta.data.mentions);
            if (Array.isArray(parsed)) {
                mdata = parsed.map(mention => ({
                    i: mention.i || mention.id || mention.user_id,
                    o: mention.o ?? mention.offset ?? 0,
                    l: mention.l ?? mention.length ?? 0
                }));
            }
        } catch (e) {}
    }
    
    // Method 3: messageMetadata.ranges (GraphQL format)
    if (mdata.length === 0 && md?.ranges && Array.isArray(md.ranges)) {
        try {
            mdata = md.ranges.map(r => ({
                i: r.entity?.id || r.mentionID || r.id || r.mention_id,
                o: r.offset ?? 0,
                l: r.length ?? 0
            }));
        } catch (e) {}
    }
    
    // Method 4: delta.mentions directly (array format)
    if (mdata.length === 0 && m.delta.mentions) {
        try {
            if (Array.isArray(m.delta.mentions)) {
                mdata = m.delta.mentions.map(mention => ({
                    i: mention.id || mention.i || mention.user_id || mention.userId,
                    o: mention.offset ?? mention.o ?? 0,
                    l: mention.length ?? mention.l ?? 0
                }));
            } else if (typeof m.delta.mentions === 'object') {
                mdata = Object.entries(m.delta.mentions).map(([id, tag]) => {
                    const offset = body.indexOf(tag);
                    return { i: id, o: offset >= 0 ? offset : 0, l: tag.length };
                });
            }
        } catch (e) {}
    }
    
    // Method 5: data.platform_xmd (newer Facebook format with nested structure)
    if (mdata.length === 0 && m.delta.data?.platform_xmd) {
        try {
            const xmd = JSON.parse(m.delta.data.platform_xmd);
            if (xmd.mention_offsets) {
                const ids = Object.keys(xmd.mention_offsets);
                for (const uid of ids) {
                    const offsets = xmd.mention_offsets[uid];
                    if (Array.isArray(offsets)) {
                        for (const offsetData of offsets) {
                            mdata.push({
                                i: uid,
                                o: offsetData.o ?? offsetData.offset ?? 0,
                                l: offsetData.l ?? offsetData.length ?? 0
                            });
                        }
                    }
                }
            }
            if (mdata.length === 0 && xmd.mentions && Array.isArray(xmd.mentions)) {
                mdata = xmd.mentions.map(mt => ({
                    i: mt.id || mt.i || mt.user_id,
                    o: mt.offset ?? mt.o ?? 0,
                    l: mt.length ?? mt.l ?? 0
                }));
            }
        } catch (e) {}
    }
    
    // Method 6: data.profile_xmd (alternative profile mentions format)
    if (mdata.length === 0 && m.delta.data?.profile_xmd) {
        try {
            const xmd = JSON.parse(m.delta.data.profile_xmd);
            if (Array.isArray(xmd)) {
                mdata = xmd.map(item => ({
                    i: item.id || item.i || item.user_id,
                    o: item.offset ?? item.o ?? 0,
                    l: item.length ?? item.l ?? 0
                }));
            }
        } catch (e) {}
    }
    
    // Method 7: delta.data with separate mention_ids/offsets/lengths arrays
    if (mdata.length === 0 && m.delta.data?.mention_ids) {
        try {
            const ids = JSON.parse(m.delta.data.mention_ids);
            const offsets = m.delta.data.mention_offsets ? JSON.parse(m.delta.data.mention_offsets) : [];
            const lengths = m.delta.data.mention_lengths ? JSON.parse(m.delta.data.mention_lengths) : [];
            for (let i = 0; i < ids.length; i++) {
                mdata.push({
                    i: ids[i],
                    o: offsets[i] ?? 0,
                    l: lengths[i] ?? 0
                });
            }
        } catch (e) {}
    }
    
    // Method 8: data.tagging (another Facebook format)
    if (mdata.length === 0 && m.delta.data?.tagging) {
        try {
            const tagging = JSON.parse(m.delta.data.tagging);
            if (Array.isArray(tagging)) {
                mdata = tagging.map(t => ({
                    i: t.id || t.user_id || t.i,
                    o: t.offset ?? t.o ?? 0,
                    l: t.length ?? t.l ?? 0
                }));
            }
        } catch (e) {}
    }
    
    // Method 9: Scan all data properties for any JSON that looks like mentions
    if (mdata.length === 0 && m.delta.data && body.includes('@')) {
        try {
            for (const key of Object.keys(m.delta.data)) {
                if (typeof m.delta.data[key] === 'string' && m.delta.data[key].startsWith('[')) {
                    try {
                        const parsed = JSON.parse(m.delta.data[key]);
                        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) {
                            const first = parsed[0];
                            if (first.i !== undefined || first.id !== undefined || first.user_id !== undefined) {
                                mdata = parsed.map(item => ({
                                    i: item.i || item.id || item.user_id,
                                    o: item.o ?? item.offset ?? 0,
                                    l: item.l ?? item.length ?? 0
                                }));
                                break;
                            }
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}
    }
    
    // Method 10: New Facebook format - data.at (2024+ format)
    if (mdata.length === 0 && m.delta.data?.at) {
        try {
            const atData = JSON.parse(m.delta.data.at);
            if (Array.isArray(atData)) {
                mdata = atData.map(item => ({
                    i: item.i || item.id || item.uid || item.user_id,
                    o: item.o ?? item.offset ?? 0,
                    l: item.l ?? item.length ?? 0
                }));
            }
        } catch (e) {}
    }
    
    // Method 11: messageMetadata.tags
    if (mdata.length === 0 && md?.tags && Array.isArray(md.tags)) {
        try {
            mdata = md.tags.map(t => ({
                i: t.id || t.user_id || t.fbid,
                o: t.offset ?? 0,
                l: t.length ?? 0
            }));
        } catch (e) {}
    }
    
    // Method 12: New xmd format with nested mention data
    if (mdata.length === 0 && m.delta.data?.xmd) {
        try {
            const xmd = JSON.parse(m.delta.data.xmd);
            if (xmd.mention) {
                const mentionData = Array.isArray(xmd.mention) ? xmd.mention : [xmd.mention];
                mdata = mentionData.map(mt => ({
                    i: mt.i || mt.id || mt.user_id || mt.uid,
                    o: mt.o ?? mt.offset ?? 0,
                    l: mt.l ?? mt.length ?? 0
                }));
            } else if (xmd.mentions) {
                const mentionData = Array.isArray(xmd.mentions) ? xmd.mentions : [xmd.mentions];
                mdata = mentionData.map(mt => ({
                    i: mt.i || mt.id || mt.user_id || mt.uid,
                    o: mt.o ?? mt.offset ?? 0,
                    l: mt.l ?? mt.length ?? 0
                }));
            } else if (xmd.tagged) {
                const taggedData = Array.isArray(xmd.tagged) ? xmd.tagged : [xmd.tagged];
                mdata = taggedData.map(t => ({
                    i: t.i || t.id || t.user_id || t.uid,
                    o: t.o ?? t.offset ?? 0,
                    l: t.l ?? t.length ?? 0
                }));
            }
        } catch (e) {}
    }
    
    // Method 13: Check for mention data in requestContext
    if (mdata.length === 0 && m.delta.requestContext?.mentions) {
        try {
            const rcMentions = m.delta.requestContext.mentions;
            if (Array.isArray(rcMentions)) {
                mdata = rcMentions.map(mt => ({
                    i: mt.id || mt.i || mt.user_id || mt.uid,
                    o: mt.offset ?? mt.o ?? 0,
                    l: mt.length ?? mt.l ?? 0
                }));
            }
        } catch (e) {}
    }
    
    // Method 14: Parse from message_ranges in newer format
    if (mdata.length === 0 && m.delta.data?.message_ranges) {
        try {
            const ranges = JSON.parse(m.delta.data.message_ranges);
            if (Array.isArray(ranges)) {
                mdata = ranges.filter(r => r.type === 'mention' || r.entity_type === 'user' || r.entity).map(r => ({
                    i: r.entity?.id || r.id || r.user_id || r.entity_id,
                    o: r.offset ?? 0,
                    l: r.length ?? 0
                }));
            }
        } catch (e) {}
    }
    
    // Method 15: Blob XMD format (newer FB format)
    if (mdata.length === 0 && m.delta.data?.blob_xmd) {
        try {
            const blobXmd = JSON.parse(m.delta.data.blob_xmd);
            if (blobXmd.mentions && Array.isArray(blobXmd.mentions)) {
                mdata = blobXmd.mentions.map(mt => ({
                    i: mt.id || mt.i || mt.user_id,
                    o: mt.offset ?? mt.o ?? 0,
                    l: mt.length ?? mt.l ?? 0
                }));
            }
        } catch (e) {}
    }
    
    // Method 16: Check snippet_annotations for mentions
    if (mdata.length === 0 && m.delta.data?.snippet_annotations) {
        try {
            const annotations = JSON.parse(m.delta.data.snippet_annotations);
            if (Array.isArray(annotations)) {
                const mentionAnnotations = annotations.filter(a => 
                    a.type === 'mention' || a.annotation_type === 'mention' || a.entity_type === 'user'
                );
                mdata = mentionAnnotations.map(a => ({
                    i: a.entity_id || a.id || a.user_id,
                    o: a.offset ?? 0,
                    l: a.length ?? 0
                }));
            }
        } catch (e) {}
    }
    
    // Build mentions object
    const mentions = {};
    for (const mention of mdata) {
        if (mention.i && body) {
            mentions[mention.i] = body.substring(mention.o, mention.o + mention.l);
        }
    }
    
    const messageReply = m.delta.messageReply ? {
        messageID: m.delta.messageReply.messageID,
        senderID: formatID(m.delta.messageReply.senderID),
        body: m.delta.messageReply.body,
        attachments: m.delta.messageReply.attachments,
        timestamp: m.delta.messageReply.timestamp,
        isReply: true
    } : null;

    return {
        type: "message",
        senderID: formatID(md.actorFbId.toString()),
        body: body,
        threadID: formatID(
            (md.threadKey.threadFbId || md.threadKey.otherUserFbId).toString()
        ),
        messageID: md.messageId,
        offlineThreadingId: md.offlineThreadingId,
        attachments: (m.delta.attachments || []).map(v => _formatAttachment(v)),
        mentions: mentions,
        timestamp: md.timestamp,
        isGroup: !!md.threadKey.threadFbId,
        participantIDs: m.delta.participants,
        messageReply: messageReply
    };
}                                     function formatID(id) {
                                                        if (id != undefined && id != null) {
                                                            return id.replace(/(fb)?id[:.]/, "");
                                                        } else {
                                                            return id;
                                                        }
                                                }

                                                function formatMessage(m) {
                                                    const originalMessage = m.message ? m.message: m;
                                                    const obj = {
                                                        type: "message",
                                                        senderName: originalMessage.sender_name,
                                                        senderID: formatID(originalMessage.sender_fbid.toString()),
                                                        participantNames: originalMessage.group_thread_info ?
                                                        originalMessage.group_thread_info.participant_names: [originalMessage.sender_name.split(" ")[0]],
                                                        participantIDs: originalMessage.group_thread_info ?
                                                        originalMessage.group_thread_info.participant_ids.map(function(v) {
                                                            return formatID(v.toString());
                                                        }): [formatID(originalMessage.sender_fbid)],
                                                        body: originalMessage.body || "",
                                                        threadID: formatID(
                                                            (
                                                                originalMessage.thread_fbid || originalMessage.other_user_fbid
                                                            ).toString()
                                                        ),
                                                        threadName: originalMessage.group_thread_info ?
                                                        originalMessage.group_thread_info.name: originalMessage.sender_name,
                                                        location: originalMessage.coordinates ? originalMessage.coordinates: null,
                                                        messageID: originalMessage.mid ?
                                                        originalMessage.mid.toString(): originalMessage.message_id,
                                                        attachments: formatAttachment(
                                                            originalMessage.attachments,
                                                            originalMessage.attachmentIds,
                                                            originalMessage.attachment_map,
                                                            originalMessage.share_map
                                                        ),
                                                        timestamp: originalMessage.timestamp,
                                                        timestampAbsolute: originalMessage.timestamp_absolute,
                                                        timestampRelative: originalMessage.timestamp_relative,
                                                        timestampDatetime: originalMessage.timestamp_datetime,
                                                        tags: originalMessage.tags,
                                                        reactions: originalMessage.reactions ? originalMessage.reactions: [],
                                                        isUnread: originalMessage.is_unread
                                                };

                                                if (m.type === "pages_messaging")
                                                    obj.pageID = m.realtime_viewer_fbid.toString();
                                                obj.isGroup = obj.participantIDs.length > 2;

                                                return obj;
                                        }

                                        function formatEvent(m) {
                                            const originalMessage = m.message ? m.message: m;
                                            let logMessageType = originalMessage.log_message_type;
                                            let logMessageData;
                                            if (logMessageType === "log:generic-admin-text") {
                                                logMessageData = originalMessage.log_message_data.untypedData;
                                                logMessageType = getAdminTextMessageType(
                                                    originalMessage.log_message_data.message_type
                                                );
                                            } else {
                                                logMessageData = originalMessage.log_message_data;
                                            }

                                            return Object.assign(formatMessage(originalMessage), {
                                                type: "event",
                                                logMessageType: logMessageType,
                                                logMessageData: logMessageData,
                                                logMessageBody: originalMessage.log_message_body
                                            });
                                    }

                                    function formatHistoryMessage(m) {
                                        switch (m.action_type) {
                                            case "ma-type:log-message":
                                                return formatEvent(m);
                                                default:
                                                    return formatMessage(m);
                                                }
                                        }


                                        function getAdminTextMessageType(type) {
                                            switch (type) {
                                                case 'unpin_messages_v2':
                                                    return 'log:unpin-message';
                                                    case 'pin_messages_v2':
                                                        return 'log:pin-message';
                                                        case "change_thread_theme":
                                                            return "log:thread-color";
                                                            case "change_thread_icon":
                                                                case 'change_thread_quick_reaction':
                                                                    return "log:thread-icon";
                                                                    case "change_thread_nickname":
                                                                        return "log:user-nickname";
                                                                        case "change_thread_admins":
                                                                            return "log:thread-admins";
                                                                            case "group_poll":
                                                                                return "log:thread-poll";
                                                                                case "change_thread_approval_mode":
                                                                                    return "log:thread-approval-mode";
                                                                                    case "messenger_call_log":
                                                                                        case "participant_joined_group_call":
                                                                                            return "log:thread-call";
                                                                                            default:
                                                                                                return type;
                                                                                            }
                                                                                    }

                                                                                    function formatDeltaEvent(m) {
                                                                                        let logMessageType;
                                                                                        let logMessageData;








                                                                                        switch (m.class) {
                                                                                            case "AdminTextMessage":
                                                                                                logMessageData = m.untypedData;
                                                                                                logMessageType = getAdminTextMessageType(m.type);
                                                                                                break;
                                                                                            case "ThreadName":
                                                                                                logMessageType = "log:thread-name";
                                                                                                logMessageData = {
                                                                                                    name: m.name
                                                                                                };
                                                                                                break;
                                                                                            case "ParticipantsAddedToGroupThread":
                                                                                                logMessageType = "log:subscribe";
                                                                                                logMessageData = {
                                                                                                    addedParticipants: m.addedParticipants
                                                                                                };
                                                                                                break;
                                                                                            case "ParticipantLeftGroupThread":
                                                                                                logMessageType = "log:unsubscribe";
                                                                                                logMessageData = {
                                                                                                    leftParticipantFbId: m.leftParticipantFbId
                                                                                                };
                                                                                                break;
                                                                                            case "ApprovalQueue":
                                                                                                logMessageType = "log:approval-queue";
                                                                                                logMessageData = {
                                                                                                    approvalQueue: {
                                                                                                        action: m.action,
                                                                                                        recipientFbId: m.recipientFbId,
                                                                                                        requestSource: m.requestSource,
                                                                                                        ...m.messageMetadata
                                                                                                    }
                                                                                                };
                                                                                        }
                                                                                        return {
                                                                                            type: "event",
                                                                                            threadID: formatID(
                                                                                                (
                                                                                                    m.messageMetadata.threadKey.threadFbId ||
                                                                                                    m.messageMetadata.threadKey.otherUserFbId
                                                                                                ).toString()
                                                                                            ),
                                                                                            messageID: m.messageMetadata.messageId.toString(),
                                                                                            logMessageType,
                                                                                            logMessageData,
                                                                                            logMessageBody: m.messageMetadata.adminText,
                                                                                            timestamp: m.messageMetadata.timestamp,
                                                                                            author: m.messageMetadata.actorFbId,
                                                                                            participantIDs: m.participants
                                                                                        };
                                                                                }

                                                                                function formatTyp(event) {
                                                                                    return {
                                                                                        isTyping: !!event.st,
                                                                                        from: event.from.toString(),
                                                                                        threadID: formatID(
                                                                                            (event.to || event.thread_fbid || event.from).toString()
                                                                                        ),


                                                                                        fromMobile: event.hasOwnProperty("from_mobile") ? event.from_mobile: true,
                                                                                        userID: (event.realtime_viewer_fbid || event.from).toString(),
                                                                                        type: "typ"
                                                                                };
                                                                        }

                                                                        function formatDeltaReadReceipt(delta) {


                                                                            return {
                                                                                reader: (delta.threadKey.otherUserFbId || delta.actorFbId).toString(),
                                                                                time: delta.actionTimestampMs,
                                                                                threadID: formatID(
                                                                                    (delta.threadKey.otherUserFbId || delta.threadKey.threadFbId).toString()
                                                                                ),
                                                                                type: "read_receipt"
                                                                        };
                                                                }

                                                                function formatReadReceipt(event) {
                                                                    return {
                                                                        reader: event.reader.toString(),
                                                                        time: event.time,
                                                                        threadID: formatID((event.thread_fbid || event.reader).toString()),
                                                                        type: "read_receipt"
                                                                };
                                                        }

                                                        function formatRead(event) {
                                                            return {
                                                                threadID: formatID(
                                                                    (
                                                                        (event.chat_ids && event.chat_ids[0]) ||
                                                                        (event.thread_fbids && event.thread_fbids[0])
                                                                    ).toString()
                                                                ),
                                                                time: event.timestamp,
                                                                type: "read"
                                                        };
                                                }

                                                function getFrom(str, startToken, endToken) {
                                                    const start = str.indexOf(startToken) + startToken.length;
                                                    if (start < startToken.length) return "";

                                                    const lastHalf = str.substring(start);
                                                    const end = lastHalf.indexOf(endToken);
                                                    if (end === -1) {
                                                        throw Error(
                                                            "Could not find endTime `" + endToken + "` in the given string."
                                                        );
                                                    }
                                                    return lastHalf.substring(0, end);
                                            }

                                            function makeParsable(html) {
                                                const withoutForLoop = html.replace(/for\s*\(\s*;\s*;\s*\)\s*;\s*/, "");










                                                const maybeMultipleObjects = withoutForLoop.split(/\}\r\n *\{/);
                                                if (maybeMultipleObjects.length === 1) return maybeMultipleObjects;

                                                return "[" + maybeMultipleObjects.join("},{") + "]";
                                            }

                                            function arrToForm(form) {
                                                return arrayToObject(
                                                    form,
                                                    function(v) {
                                                        return v.name;
                                                    },
                                                    function(v) {
                                                        return v.val;
                                                    }
                                                );
                                            }

                                            function arrayToObject(arr, getKey, getValue) {
                                                return arr.reduce(function(acc, val) {
                                                    acc[getKey(val)] = getValue(val);
                                                    return acc;
                                                }, {});
                                            }

                                            function getSignatureID() {
                                                return Math.floor(Math.random() * 2147483648).toString(16);
                                            }

                                            function generateTimestampRelative() {
                                                const d = new Date();
                                                return d.getHours() + ":" + padZeros(d.getMinutes());
                                            }

                                            function makeDefaults(html, userID, ctx) {
                                                let reqCounter = 1;
                                                const revision = getFrom(html, 'revision":', ",");
                                                function mergeWithDefaults(obj) {
                                                    const newObj = {
                                                        av: userID,
                                                        __user: userID,
                                                        __req: (reqCounter++).toString(36),
                                                        __rev: revision,
                                                        __a: 1,
                                                        ...(ctx && {
                                                            fb_dtsg: ctx.fb_dtsg,
                                                            jazoest: ctx.jazoest
                                                    })
                                                }

                                                if (!obj) return newObj;

                                                for (var prop in obj) {
                                                    if (obj.hasOwnProperty(prop)) {
                                                        if (!newObj[prop])
                                                            newObj[prop] = obj[prop];
                                                    }
                                                }

                                                return newObj;
                                            }

                                            return {
                                                get: (url, jar, qs, ctxx, customHeader = {}) => get(url, jar, mergeWithDefaults(qs), ctx.globalOptions, ctxx || ctx, customHeader),
                                                post: (url, jar, form, ctxx, customHeader = {}) => post(url, jar, mergeWithDefaults(form), ctx.globalOptions, ctxx || ctx, customHeader),
                                                postFormData: (url, jar, form, qs, ctxx) => postFormData(url, jar, mergeWithDefaults(form), mergeWithDefaults(qs), ctx.globalOptions, ctxx || ctx)
                                            };
                                        }

                                        function parseAndCheckLogin(ctx, http, retryCount) {
                                            var delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
                                            var _try = (tryData) => new Promise(function(resolve, reject) {
                                                try {
                                                    resolve(tryData());
                                                } catch (error) {
                                                    reject(error);
                                                }
                                            });
                                            if (retryCount == undefined) retryCount = 0;

                                            return function(data) {
                                                function any() {
                                                    if (data.statusCode >= 500 && data.statusCode < 600) {
                                                        if (retryCount >= 5) {
                                                            const err = new Error("Request retry failed. Check the `res` and `statusCode` property on this error.");
                                                            err.statusCode = data.statusCode;
                                                            err.res = data.body;
                                                            err.error = "Request retry failed. Check the `res` and `statusCode` property on this error.";
                                                            throw err;
                                                        }
                                                        retryCount++;
                                                        const retryTime = Math.floor(Math.random() * 5000);
                                                        console.warn("parseAndCheckLogin", "Got status code " + data.statusCode + " - " + retryCount + ". attempt to retry in " + retryTime + " milliseconds...");
                                                        const url = data.request.uri.protocol + "//" + data.request.uri.hostname + data.request.uri.pathname;
                                                        if (data.request.headers["content-type"].split(";")[0] === "multipart/form-data") {
                                                            return delay(retryTime)
                                                            .then(function() {
                                                                return http
                                                                .postFormData(url, ctx.jar, data.request.formData);
                                                        })
                                                        .then(parseAndCheckLogin(ctx, http, retryCount));
                                                    } else {
                                                        return delay(retryTime)
                                                        .then(function() {
                                                            return http
                                                            .post(url, ctx.jar, data.request.formData);
                                                    })
                                                    .then(parseAndCheckLogin(ctx, http, retryCount));
                                                }
                                            }

                                            if (data.statusCode === 404) return;

                                            if (data.statusCode !== 200)
                                                throw new Error("parseAndCheckLogin got status code: " + data.statusCode + ". Bailing out of trying to parse response.");

                                            let res = null;
                                            try {
                                                res = JSON.parse(makeParsable(data.body));
                                            } catch (e) {
                                                const err = new Error("JSON.parse error. Check the `detail` property on this error.");
                                                err.error = "JSON.parse error. Check the `detail` property on this error.";
                                                err.detail = e;
                                                err.res = data.body;
                                                throw err;
                                            }


                                            if (res.redirect && data.request.method === "GET") {
                                                return http
                                                .get(res.redirect, ctx.jar)
                                                .then(parseAndCheckLogin(ctx, http));
                                            }


                                            if (res.jsmods && res.jsmods.require && Array.isArray(res.jsmods.require[0]) && res.jsmods.require[0][0] === "Cookie") {
                                                res.jsmods.require[0][3][0] = res.jsmods.require[0][3][0].replace("_js_", "");
                                                const requireCookie = res.jsmods.require[0][3];
                                                ctx.jar.setCookie(formatCookie(requireCookie, "facebook"), "https://www.facebook.com");
                                                ctx.jar.setCookie(formatCookie(requireCookie, "messenger"), "https://www.messenger.com");
                                            }



                                            if (res.jsmods && Array.isArray(res.jsmods.require)) {
                                                const arr = res.jsmods.require;
                                                for (const i in arr) {
                                                    if (arr[i][0] === "DTSG" && arr[i][1] === "setToken") {
                                                        ctx.fb_dtsg = arr[i][3][0];


                                                        ctx.ttstamp = "2";
                                                        for (let j = 0; j < ctx.fb_dtsg.length; j++) {
                                                            ctx.ttstamp += ctx.fb_dtsg.charCodeAt(j);
                                                        }
                                                    }
                                                }
                                            }

                                            if (res.error === 1357001 || res.error === 1357004) {
                                                const errMsg = res.error === 1357004 ? 'Account temporarily locked or blocked' : 'Facebook blocked the login';
                                                const err = new Error(errMsg);
                                                err.error = "Not logged in.";
                                                err.requiresReLogin = true;
                                                err.loginBlocked = res.error === 1357004;
                                                throw err;
                                            }

                                            if (res.errors && Array.isArray(res.errors)) {
                                                for (const errorObj of res.errors) {
                                                    const errorMsg = errorObj.message || errorObj.description || '';
                                                    if (/Not logged in|blocked the login|401|403/.test(errorMsg)) {
                                                        const err = new Error('Authentication error: ' + errorMsg);
                                                        err.error = "Not logged in.";
                                                        err.requiresReLogin = true;
                                                        err.loginBlocked = /blocked/.test(errorMsg);
                                                        throw err;
                                                    }
                                                }
                                            }
                                            return res;
                                        }
                                        return _try(any);
                                };
                        }

                        function saveCookies(jar) {
                            return function(res) {
                                if (!res || !res.headers) return res;
                                const cookies = res.headers["set-cookie"] || [];
                                cookies.forEach(function(c) {
                                    if (c.indexOf(".facebook.com") > -1) {
                                        jar.setCookie(c, "https://www.facebook.com");
                                    }
                                    const c2 = c.replace(/domain=\.facebook\.com/, "domain=.messenger.com");
                                    jar.setCookie(c2, "https://www.messenger.com");
                            });
                            return res;
                    };
            }

    function formatThread(data) {
        return {
            threadID: formatID(data.thread_fbid.toString()),
            participants: data.participants.map(formatID),
            participantIDs: data.participants.map(formatID),
            name: data.name,
            nicknames: data.custom_nickname,
            snippet: data.snippet,
            snippetAttachments: data.snippet_attachments,
            snippetSender: formatID((data.snippet_sender || "").toString()),
            unreadCount: data.unread_count,
            messageCount: data.message_count,
            imageSrc: data.image_src,
            timestamp: data.timestamp,
            serverTimestamp: data.server_timestamp,
            muteUntil: data.mute_until,
            isCanonicalUser: data.is_canonical_user,
            isCanonical: data.is_canonical,
            isSubscribed: data.is_subscribed,
            folder: data.folder,
            isArchived: data.is_archived,
            recipientsLoadable: data.recipients_loadable,
            hasEmailParticipant: data.has_email_participant,
            readOnly: data.read_only,
            canReply: data.can_reply,
            cannotReplyReason: data.cannot_reply_reason,
            lastMessageTimestamp: data.last_message_timestamp,
            lastReadTimestamp: data.last_read_timestamp,
            lastMessageType: data.last_message_type,
            emoji: data.custom_like_icon,
            color: data.custom_color,
            adminIDs: data.admin_ids,
            threadType: data.thread_type
    };
}

function formatDate(date) {
 let d = date.getUTCDate();
 d = d >= 10 ? d : "0" + d;
 let h = date.getUTCHours();
 h = h >= 10 ? h : "0" + h;
 let m = date.getUTCMinutes();
 m = m >= 10 ? m : "0" + m;
 let s = date.getUTCSeconds();
 s = s >= 10 ? s : "0" + s;
 return (
 NUM_TO_DAY[date.getUTCDay()] +
 ", " +
 d +
 " " +
 NUM_TO_MONTH[date.getUTCMonth()] +
 " " +
 date.getUTCFullYear() +
 " " +
 h +
 ":" +
 m +
 ":" +
 s +
 " GMT"
 );
}

function formatCookie(arr, url) {
 return (
 arr[0] + "=" + arr[1] + "; Path=" + arr[3] + "; Domain=" + url + ".com"
 );
}

function formatProxyPresence(presence, userID) {
    if (presence.lat === undefined || presence.p === undefined) return null;
    return {
        type: "presence",
        timestamp: presence.lat * 1000,
        userID: userID,
        statuses: presence.p
    };
}

function formatPresence(presence, userID) {
    return {
        type: "presence",
        timestamp: presence.la * 1000,
        userID: userID,
        statuses: presence.a
    };
}

function decodeClientPayload(payload) {
    /*
Special function which Client using to "encode" clients JSON payload
*/
    return JSON.parse(String.fromCharCode.apply(null, payload));
}


module.exports = {

  isReadableStream,

  getExtension,

  _formatAttachment,

  formatAttachment,

  formatDeltaMessage,

  formatID,

  formatMessage,

  formatEvent,

  formatHistoryMessage,

  getAdminTextMessageType,

  formatDeltaEvent,

  formatTyp,

  formatDeltaReadReceipt,

  formatReadReceipt,

  formatRead,

  formatDate,

  formatCookie,

  formatThread,

  formatProxyPresence,

  formatPresence,

  decodeClientPayload,
};
