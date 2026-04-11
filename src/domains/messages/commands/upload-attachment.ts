import { createLegacyPromise } from "../../../compat/legacy-promise";
import type { NodeStyleCallback } from "../../../compat/callbackify";
import { createAttachmentUploadTransport } from "../../../transport/http/upload-attachment";
import type {
  UploadAttachmentInput,
  UploadAttachmentResult
} from "../message.types";

interface UploadAttachmentLogger {
  info?: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
}

export interface UploadAttachmentCommandDeps {
  ctx: {
    jar?: Loose;
    options?: {
      userAgent?: string;
    };
    userID?: string;
    userId?: string;
  };
  logger?: UploadAttachmentLogger;
  logError?: (scope: string, error: Loose) => void;
}

export function createUploadAttachmentCommand(deps: UploadAttachmentCommandDeps) {
  const { ctx, logger, logError } = deps;
  const uploadAttachments = createAttachmentUploadTransport({
    ctx,
    logger
  });

  return function uploadAttachment(
    attachments: UploadAttachmentInput | UploadAttachmentInput[],
    callback?: NodeStyleCallback<UploadAttachmentResult>
  ) {
    const { callback: legacyCallback, promise } = createLegacyPromise<UploadAttachmentResult>(
      callback,
      []
    );

    const inputs = Array.isArray(attachments) ? attachments : [attachments];

    if (!inputs.length) {
      const error = { error: "Please pass an attachment or an array of attachments." };
      legacyCallback(error);
      return promise;
    }

    uploadAttachments(inputs, { mode: "parallel" })
      .then((result) => legacyCallback(null, result.ids))
      .catch((error: Loose) => {
        logError?.("uploadAttachment", error);
        legacyCallback(error);
      });

    return promise;
  };
}
