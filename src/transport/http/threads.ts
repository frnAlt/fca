import type { FcaContext } from "../../core/state";
import type { LegacyDefaultFuncs } from "../contracts/request";
import { postWithLoginCheck } from "./facebook";
import { parseAndCheckLogin, saveCookies } from "../../utils/client";

export async function changeThreadMuteViaMercury(params: {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  threadID: string | number;
  muteSeconds: number;
}): Promise<Loose> {
  const { defaultFuncs, ctx, threadID, muteSeconds } = params;

  return defaultFuncs
    .post(
      "https://www.facebook.com/ajax/mercury/change_mute_thread.php",
      ctx.jar,
      {
        thread_fbid: threadID,
        mute_settings: muteSeconds
      }
    )
    .then(saveCookies(ctx.jar))
    .then(parseAndCheckLogin(ctx as Loose, defaultFuncs as Loose));
}

export async function setThreadTitleViaHttp(params: {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  form: Record<string, Loose>;
}): Promise<Loose> {
  const { defaultFuncs, ctx, form } = params;

  return defaultFuncs
    .post("https://www.facebook.com/messaging/set_thread_name/", ctx.jar, form)
    .then(parseAndCheckLogin(ctx as Loose, defaultFuncs as Loose));
}

export async function searchThreadsViaMercury(params: {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  query: string;
}): Promise<Loose> {
  const { defaultFuncs, ctx, query } = params;

  return defaultFuncs
    .post(
      "https://www.facebook.com/ajax/mercury/search_threads.php",
      ctx.jar,
      {
        client: "web_messenger",
        query,
        offset: 0,
        limit: 21,
        index: "fbid"
      }
    )
    .then(parseAndCheckLogin(ctx as Loose, defaultFuncs as Loose));
}

export async function changeThreadEmojiViaHttp(params: {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  emoji: string;
  threadID: string | number;
}): Promise<Loose> {
  const { defaultFuncs, ctx, emoji, threadID } = params;

  return defaultFuncs
    .post(
      "https://www.facebook.com/messaging/save_thread_emoji/?source=thread_settings&__pc=EXP1%3Amessengerdotcom_pkg",
      ctx.jar,
      {
        emoji_choice: emoji,
        thread_or_other_fbid: threadID
      }
    )
    .then(parseAndCheckLogin(ctx as Loose, defaultFuncs as Loose));
}

export async function uploadGroupImageViaMercury(params: {
  defaultFuncs: {
    postFormData: (url: string, jar: Loose, form: Record<string, Loose>, query?: Record<string, Loose>) => Promise<Loose>;
  };
  ctx: FcaContext;
  image: Loose;
}): Promise<Loose> {
  const { defaultFuncs, ctx, image } = params;

  return defaultFuncs
    .postFormData(
      "https://www.facebook.com/ajax/mercury/upload.php",
      ctx.jar,
      {
        images_only: "true",
        fb_dtsg: ctx.fb_dtsg,
        "attachment[]": image
      },
      {}
    )
    .then(parseAndCheckLogin(ctx as Loose, defaultFuncs as Loose));
}

export async function changeArchivedStatusViaMercury(params: {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  form: Record<string, Loose>;
}): Promise<Loose> {
  const { defaultFuncs, ctx, form } = params;

  return defaultFuncs
    .post(
      "https://www.facebook.com/ajax/mercury/change_archived_status.php",
      ctx.jar,
      form
    )
    .then(parseAndCheckLogin(ctx as Loose, defaultFuncs as Loose));
}

export async function moveThreadsViaMercury(params: {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  form: Record<string, Loose>;
}): Promise<Loose> {
  const { defaultFuncs, ctx, form } = params;

  return defaultFuncs
    .post(
      "https://www.facebook.com/ajax/mercury/move_thread.php",
      ctx.jar,
      form
    )
    .then(parseAndCheckLogin(ctx as Loose, defaultFuncs as Loose));
}

export async function deleteThreadsViaMercury(params: {
  defaultFuncs: LegacyDefaultFuncs;
  ctx: FcaContext;
  threadIDs: Array<string | number>;
}): Promise<Loose> {
  const { defaultFuncs, ctx, threadIDs } = params;
  const form: Record<string, Loose> = {
    client: "mercury"
  };

  threadIDs.forEach((threadID, index) => {
    form[`ids[${index}]`] = threadID;
  });

  return postWithLoginCheck({
    defaultFuncs,
    ctx,
    url: "https://www.facebook.com/ajax/mercury/delete_thread.php",
    form
  });
}
