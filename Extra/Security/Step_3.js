'use strict';

const crypto = require('crypto');

module.exports.encryptState = function encryptState(data, key) {
    try {
        const aes = require("aes-js");
        let hashEngine = crypto.createHash("sha256");
        let hashKey = hashEngine.update(key).digest();
        let bytes = aes.utils.utf8.toBytes(data);
        let aesCtr = new aes.ModeOfOperation.ctr(hashKey);
        let encryptedData = aesCtr.encrypt(bytes);
        return aes.utils.hex.fromBytes(encryptedData);
    } catch (_) {
        const hashKey = crypto.createHash("sha256").update(key).digest();
        const iv = Buffer.alloc(16, 0);
        const cipher = crypto.createCipheriv("aes-256-ctr", hashKey, iv);
        const encrypted = Buffer.concat([cipher.update(Buffer.from(data, "utf8")), cipher.final()]);
        return encrypted.toString("hex");
    }
};

module.exports.decryptState = function decryptState(data, key) {
    try {
        const aes = require("aes-js");
        let hashEngine = crypto.createHash("sha256");
        let hashKey = hashEngine.update(key).digest();
        let encryptedBytes = aes.utils.hex.toBytes(data);
        let aesCtr = new aes.ModeOfOperation.ctr(hashKey);
        let decryptedData = aesCtr.decrypt(encryptedBytes);
        return aes.utils.utf8.fromBytes(decryptedData);
    } catch (_) {
        const hashKey = crypto.createHash("sha256").update(key).digest();
        const iv = Buffer.alloc(16, 0);
        const decipher = crypto.createDecipheriv("aes-256-ctr", hashKey, iv);
        const decrypted = Buffer.concat([decipher.update(Buffer.from(data, "hex")), decipher.final()]);
        return decrypted.toString("utf8");
    }
};
