import type { FcaContext } from "../../core/state";
import type { LegacyDefaultFuncs } from "../contracts/request";
import { getPageID } from "../../session/session";
import { postWithSavedCookiesAndLoginCheck } from "./facebook";
import { parseAndCheckLogin, saveCookies } from "../../utils/client";

export async function changeReadStatusViaMercury(params: {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  threadID: string;
  read: boolean;
}): Promise<Loose> {
  const { defaultFuncs, ctx, threadID, read } = params;
  const pageID = getPageID(ctx);

  if (!pageID) {
    throw new Error("pageID is required for Mercury read status updates");
  }

  const form: Record<string, Loose> = {
    source: "PagesManagerMessagesInterface",
    request_user_id: pageID,
    [`ids[${threadID}]`]: read,
    watermarkTimestamp: Date.now(),
    shouldSendReadReceipt: true,
    commerce_last_message_type: ""
  };

  return defaultFuncs
    .post(
      "https://www.facebook.com/ajax/mercury/change_read_status.php",
      ctx.jar,
      form
    )
    .then(saveCookies(ctx.jar))
    .then(parseAndCheckLogin(ctx as Loose, defaultFuncs as Loose));
}

export async function markSeenViaMercury(params: {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  seenTimestamp: number;
}): Promise<Loose> {
  const { defaultFuncs, ctx, seenTimestamp } = params;

  return postWithSavedCookiesAndLoginCheck({
    defaultFuncs,
    ctx,
    url: "https://www.facebook.com/ajax/mercury/mark_seen.php",
    form: {
      seen_timestamp: seenTimestamp
    }
  });
}

export async function markDeliveredViaMercury(params: {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  threadID: string | number;
  messageID: string;
}): Promise<Loose> {
  const { defaultFuncs, ctx, threadID, messageID } = params;

  return postWithSavedCookiesAndLoginCheck({
    defaultFuncs,
    ctx,
    url: "https://www.facebook.com/ajax/mercury/delivery_receipts.php",
    form: {
      "message_ids[0]": messageID,
      [`thread_ids[${threadID}][0]`]: messageID
    }
  });
}

export async function markFolderAsReadViaMercury(params: {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  folder?: string;
}): Promise<Loose> {
  const { defaultFuncs, ctx, folder = "inbox" } = params;

  return postWithSavedCookiesAndLoginCheck({
    defaultFuncs,
    ctx,
    url: "https://www.facebook.com/ajax/mercury/mark_folder_as_read.php",
    form: {
      folder
    }
  });
}
