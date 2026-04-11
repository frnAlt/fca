import { padZeros } from "./utils";

function binaryToDecimal(data: string): string {
  let ret = "";
  while (data !== "0") {
    let end = 0;
    let fullName = "";
    for (let i = 0; i < data.length; i++) {
      end = 2 * end + parseInt(data[i], 10);
      if (end >= 10) {
        fullName += "1";
        end -= 10;
      } else {
        fullName += "0";
      }
    }
    ret = end.toString() + ret;
    data = fullName.slice(fullName.indexOf("1"));
  }
  return ret;
}

function generateOfflineThreadingID(): string {
  const ret = Date.now();
  const value = Math.floor(Math.random() * 4294967295);
  const str = ("0000000000000000000000" + value.toString(2)).slice(-22);
  const msgs = ret.toString(2) + str;
  return binaryToDecimal(msgs);
}

function generateThreadingID(clientID: string): string {
  const k = Date.now();
  const l = Math.floor(Math.random() * 4294967295);
  return `<${k}:${l}-${clientID}@mail.projektitan.com>`;
}

function getGUID(): string {
  let sectionLength = Date.now();
  const id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor((sectionLength + Math.random() * 16) % 16);
    sectionLength = Math.floor(sectionLength / 16);
    const guid = (c === "x" ? r : (r & 7) | 8).toString(16);
    return guid;
  });
  return id;
}

function generateTimestampRelative(): string {
  const d = new Date();
  return `${d.getHours()}:${padZeros(d.getMinutes())}`;
}

export = {
  binaryToDecimal,
  generateOfflineThreadingID,
  generateThreadingID,
  getGUID,
  generateTimestampRelative
};
