import CryptoJS from 'crypto-js';

const KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'ghost-default-key';

export function encrypt(plainText) {
  return CryptoJS.AES.encrypt(plainText, KEY).toString();
}

export function decrypt(cipherText) {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, KEY);
    return bytes.toString(CryptoJS.enc.Utf8) || cipherText;
  } catch {
    return cipherText;
  }
}
