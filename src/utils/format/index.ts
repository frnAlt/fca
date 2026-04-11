import attachment from "./attachment";
import cookie from "./cookie";
import date from "./date";
import decode from "./decode";
import delta from "./delta";
import ids from "./ids";
import message from "./message";
import presence from "./presence";
import readTyp from "./readTyp";
import thread from "./thread";
import * as utils from "./utils";

export = {
  getType: utils.getType,
  formatID: utils.formatID,
  padZeros: utils.padZeros,
  arrayToObject: utils.arrayToObject,
  arrToForm: utils.arrToForm,
  getData_Path: utils.getData_Path,
  setData_Path: utils.setData_Path,
  getPaths: utils.getPaths,
  cleanHTML: utils.cleanHTML,
  getCurrentTimestamp: utils.getCurrentTimestamp,
  getSignatureID: utils.getSignatureID,

  generateOfflineThreadingID: ids.generateOfflineThreadingID,
  generateThreadingID: ids.generateThreadingID,
  getGUID: ids.getGUID,
  generateTimestampRelative: ids.generateTimestampRelative,

  formatDate: date.formatDate,

  presenceEncode: presence.presenceEncode,
  presenceDecode: presence.presenceDecode,
  generatePresence: presence.generatePresence,
  generateAccessiblityCookie: presence.generateAccessiblityCookie,
  formatProxyPresence: presence.formatProxyPresence,
  formatPresence: presence.formatPresence,

  _formatAttachment: attachment._formatAttachment,
  formatAttachment: attachment.formatAttachment,

  getAdminTextMessageType: delta.getAdminTextMessageType,
  formatDeltaEvent: delta.formatDeltaEvent,
  formatDeltaMessage: delta.formatDeltaMessage,
  getMentionsFromDeltaMessage: delta.getMentionsFromDeltaMessage,
  formatDeltaReadReceipt: delta.formatDeltaReadReceipt,

  formatMessage: message.formatMessage,
  formatEvent: message.formatEvent,
  formatHistoryMessage: message.formatHistoryMessage,

  formatReadReceipt: readTyp.formatReadReceipt,
  formatRead: readTyp.formatRead,
  formatTyp: readTyp.formatTyp,

  formatThread: thread.formatThread,

  decodeClientPayload: decode.decodeClientPayload,

  formatCookie: cookie.formatCookie
};
