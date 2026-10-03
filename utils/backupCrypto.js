'use strict';
// AES-256-GCM file encryption for off-machine backup copies. Key = scrypt(passphrase, random salt). Streams, so big dumps are fine.
// File layout: "BHB1" | salt(16) | iv(12) | ciphertext | auth tag(16). A wrong passphrase or any changed byte fails the tag check.
// The passphrase is only ever an argument: it is never logged, written, or put in an error message.
const crypto = require('crypto');
const fs = require('fs');

const MAGIC = Buffer.from('BHB1'), SALT = 16, IV = 12, TAG = 16, HEADER = MAGIC.length + SALT + IV;
const keyFrom = (pass, salt) => crypto.scryptSync(String(pass), salt, 32, { N: 16384, r: 8, p: 1 });

function needPass(pass) { if (!pass || String(pass).length < 8) throw new Error('A backup passphrase of at least 8 characters is required'); }

function encryptFile(src, dest, pass) {
    needPass(pass);
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(SALT), iv = crypto.randomBytes(IV);
        const cipher = crypto.createCipheriv('aes-256-gcm', keyFrom(pass, salt), iv);
        const out = fs.createWriteStream(dest);
        const fail = e => { out.destroy(); fs.unlink(dest, () => {}); reject(e); };
        out.on('error', fail);
        out.write(Buffer.concat([MAGIC, salt, iv]));
        const inp = fs.createReadStream(src); inp.on('error', fail); cipher.on('error', fail);
        inp.pipe(cipher).on('data', c => out.write(c)).on('end', () => { out.end(cipher.getAuthTag(), () => resolve(dest)); });
    });
}

function decryptFile(src, dest, pass) {
    needPass(pass);
    return new Promise((resolve, reject) => {
        const size = fs.statSync(src).size;
        if (size < HEADER + TAG) return reject(new Error('Not an encrypted backup (file too small)'));
        const fd = fs.openSync(src, 'r'), head = Buffer.alloc(HEADER), tag = Buffer.alloc(TAG);
        fs.readSync(fd, head, 0, HEADER, 0); fs.readSync(fd, tag, 0, TAG, size - TAG); fs.closeSync(fd);
        if (!head.subarray(0, MAGIC.length).equals(MAGIC)) return reject(new Error('Not an encrypted backup (bad header)'));
        const decipher = crypto.createDecipheriv('aes-256-gcm', keyFrom(pass, head.subarray(4, 4 + SALT)), head.subarray(4 + SALT, HEADER));
        decipher.setAuthTag(tag);
        const out = fs.createWriteStream(dest);
        const fail = e => { out.destroy(); fs.unlink(dest, () => {}); reject(e.message && /auth/i.test(e.message) ? new Error('Wrong passphrase or damaged backup (authentication failed)') : e); };
        out.on('error', fail); decipher.on('error', fail);
        const inp = fs.createReadStream(src, { start: HEADER, end: size - TAG - 1 }); inp.on('error', fail);
        inp.pipe(decipher).on('data', c => out.write(c)).on('end', () => { out.end(() => resolve(dest)); });
    });
}

module.exports = { encryptFile, decryptFile };
