"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatusCodeForMediaRetry = exports.decryptMediaRetryData = exports.decodeMediaRetryNode = exports.encryptMediaRetryRequest = exports.getWAUploadToServer = exports.downloadEncryptedContent = exports.downloadContentFromMessage = exports.getUrlFromDirectPath = exports.encryptedStream = exports.prepareStream = exports.getHttpStream = exports.getStream = exports.toBuffer = exports.toReadable = exports.mediaMessageSHA256B64 = exports.generateProfilePicture = exports.encodeBase64EncodedStringForUpload = exports.extractImageThumb = exports.extractVideoThumb = exports.hkdfInfoKey = void 0;
exports.getMediaKeys = getMediaKeys;
exports.uploadFile = uploadFile;
exports.vid2jpg = vid2jpg;
exports.getAudioDuration = getAudioDuration;
exports.getAudioWaveform = getAudioWaveform;
exports.generateThumbnail = generateThumbnail;
exports.extensionForMediaMessage = extensionForMediaMessage;
const boom_1 = require("@hapi/boom");
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const cheerio = __importStar(require("cheerio"));
const Crypto = __importStar(require("crypto"));
const events_1 = require("events");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const jimp_1 = __importDefault(require("jimp"));
const stream_1 = require("stream");
const WAProto_1 = require("../../WAProto");
const Defaults_1 = require("../Defaults");
const WABinary_1 = require("../WABinary");
const crypto_1 = require("./crypto");
const generics_1 = require("./generics");
const getTmpFilesDirectory = () => (0, os_1.tmpdir)();
const getImageProcessingLibrary = async () => {
    const [_jimp, sharp] = await Promise.all([
        (async () => {
            const jimp = await (Promise.resolve().then(() => __importStar(require('jimp'))).catch(() => { }));
            return jimp;
        })(),
        (async () => {
            const sharp = await (Promise.resolve().then(() => __importStar(require('sharp'))).catch(() => { }));
            return sharp;
        })()
    ]);
    if (sharp) {
        return { sharp };
    }
    const jimp = (_jimp === null || _jimp === void 0 ? void 0 : _jimp.default) || _jimp;
    if (jimp) {
        return { jimp };
    }
    throw new boom_1.Boom('No image processing library available');
};
const hkdfInfoKey = (type) => {
    const hkdfInfo = Defaults_1.MEDIA_HKDF_KEY_MAPPING[type];
    return `WhatsApp ${hkdfInfo} Keys`;
};
exports.hkdfInfoKey = hkdfInfoKey;
/** generates all the keys required to encrypt/decrypt & sign a media message */
async function getMediaKeys(buffer, mediaType) {
    if (!buffer) {
        throw new boom_1.Boom('Cannot derive from empty media key');
    }
    if (typeof buffer === 'string') {
        buffer = Buffer.from(buffer.replace('data:;base64,', ''), 'base64');
    }
    // expand using HKDF to 112 bytes, also pass in the relevant app info
    const expandedMediaKey = await (0, crypto_1.hkdf)(buffer, 112, { info: (0, exports.hkdfInfoKey)(mediaType) });
    return {
        iv: expandedMediaKey.slice(0, 16),
        cipherKey: expandedMediaKey.slice(16, 48),
        macKey: expandedMediaKey.slice(48, 80),
    };
}
async function uploadFile(buffer, logger) {
    const { fromBuffer } = await Promise.resolve().then(() => __importStar(require('file-type')));
    const fileType = await fromBuffer(buffer);
    if (!fileType)
        throw new Error("Failed to detect file type.");
    const { ext, mime } = fileType;
    const services = [
        {
            name: "catbox",
            url: "https://catbox.moe/user/api.php",
            buildForm: () => {
                const form = new form_data_1.default();
                form.append("fileToUpload", buffer, {
                    filename: `file.${ext}`,
                    contentType: mime || "application/octet-stream"
                });
                form.append("reqtype", "fileupload");
                return form;
            },
            parseResponse: res => res.data
        },
        {
            name: "pdi.moe",
            url: "https://scdn.pdi.moe/upload",
            buildForm: () => {
                const form = new form_data_1.default();
                form.append("file", buffer, {
                    filename: `file.${ext}`,
                    contentType: mime
                });
                return form;
            },
            parseResponse: res => res.data.result.url
        },
        {
            name: "qu.ax",
            url: "https://qu.ax/upload.php",
            buildForm: () => {
                const form = new form_data_1.default();
                form.append("files[]", buffer, {
                    filename: `file.${ext}`,
                    contentType: mime || "application/octet-stream"
                });
                return form;
            },
            parseResponse: res => {
                var _a, _b, _c;
                if (!((_c = (_b = (_a = res.data) === null || _a === void 0 ? void 0 : _a.files) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.url))
                    throw new Error("Failed to get URL from qu.ax");
                return res.data.files[0].url;
            }
        },
        {
            name: "uguu.se",
            url: "https://uguu.se/upload.php",
            buildForm: () => {
                const form = new form_data_1.default();
                form.append("files[]", buffer, {
                    filename: `file.${ext}`,
                    contentType: mime || "application/octet-stream"
                });
                return form;
            },
            parseResponse: res => {
                var _a, _b, _c;
                if (!((_c = (_b = (_a = res.data) === null || _a === void 0 ? void 0 : _a.files) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.url))
                    throw new Error("Failed to get URL from uguu.se");
                return res.data.files[0].url;
            }
        },
        {
            name: "tmpfiles",
            url: "https://tmpfiles.org/api/v1/upload",
            buildForm: () => {
                const form = new form_data_1.default();
                form.append("file", buffer, {
                    filename: `file.${ext}`,
                    contentType: mime
                });
                return form;
            },
            parseResponse: res => {
                const match = res.data.data.url.match(/https:\/\/tmpfiles\.org\/(.*)/);
                if (!match)
                    throw new Error("Failed to parse tmpfiles URL.");
                return `https://tmpfiles.org/dl/${match[1]}`;
            }
        }
    ];
    for (const service of services) {
        try {
            const form = service.buildForm();
            const res = await axios_1.default.post(service.url, form, {
                headers: form.getHeaders()
            });
            const url = service.parseResponse(res);
            return url;
        }
        catch (error) {
            logger === null || logger === void 0 ? void 0 : logger.debug(`[${service.name}] eror:`, (error === null || error === void 0 ? void 0 : error.message) || error);
        }
    }
    throw new Error("All upload services failed.");
}
async function vid2jpg(videoUrl) {
    try {
        const { data } = await axios_1.default.get(`https://ezgif.com/video-to-jpg?url=${encodeURIComponent(videoUrl)}`);
        const $ = cheerio.load(data);
        const fileToken = $('input[name="file"]').attr("value");
        if (!fileToken) {
            throw new Error("Failed to retrieve file token. The video URL may be invalid or inaccessible.");
        }
        const formData = new URLSearchParams();
        formData.append("file", fileToken);
        formData.append("end", "1");
        formData.append("video-to-jpg", "Convert to JPG!");
        const convert = await axios_1.default.post(`https://ezgif.com/video-to-jpg/${fileToken}`, formData);
        const $2 = cheerio.load(convert.data);
        let imageUrl = $2("#output img").first().attr("src");
        if (!imageUrl) {
            throw new Error("Could not locate the converted image output.");
        }
        if (imageUrl.startsWith("//")) {
            imageUrl = "https:" + imageUrl;
        }
        else if (imageUrl.startsWith("/")) {
            const cdnMatch = imageUrl.match(/\/(s\d+\..+?)\/.*/);
            if (cdnMatch) {
                imageUrl = "https://" + imageUrl.slice(2);
            }
            else {
                imageUrl = "https://ezgif.com" + imageUrl;
            }
        }
        return imageUrl;
    }
    catch (error) {
        throw new Error("Failed to convert video to JPG: " + error.message);
    }
}
/**
 * Originally written by Techwiz (https://github.com/techwiz37)
 * Modified for customization and improvements
 */
const extractVideoThumb = async (videoPath) => {
    const videoBuffer = await fs_1.promises.readFile(videoPath);
    const dataUrl = await uploadFile(videoBuffer);
    if (!dataUrl || typeof dataUrl !== 'string') {
        throw new Error('Failed to upload video: Invalid or missing URL');
    }
    const jpgUrl = await vid2jpg(dataUrl);
    const { data: imageBuffer } = await axios_1.default.get(jpgUrl, {
        responseType: 'arraybuffer',
    });
    return imageBuffer;
};
exports.extractVideoThumb = extractVideoThumb;
const extractImageThumb = async (bufferOrFilePath, width = 32) => {
    var _a, _b;
    if (bufferOrFilePath instanceof stream_1.Readable) {
        bufferOrFilePath = await (0, exports.toBuffer)(bufferOrFilePath);
    }
    const lib = await getImageProcessingLibrary();
    if ('sharp' in lib && typeof ((_a = lib.sharp) === null || _a === void 0 ? void 0 : _a.default) === 'function') {
        const img = lib.sharp.default(bufferOrFilePath);
        const dimensions = await img.metadata();
        const buffer = await img
            .resize(width)
            .jpeg({ quality: 50 })
            .toBuffer();
        return {
            buffer,
            original: {
                width: dimensions.width,
                height: dimensions.height,
            },
        };
    }
    else if ('jimp' in lib && typeof ((_b = lib.jimp) === null || _b === void 0 ? void 0 : _b.read) === 'function') {
        const { read, MIME_JPEG, RESIZE_BILINEAR, AUTO } = lib.jimp;
        const jimp = await read(bufferOrFilePath);
        const dimensions = {
            width: jimp.getWidth(),
            height: jimp.getHeight()
        };
        const buffer = await jimp
            .quality(50)
            .resize(width, AUTO, RESIZE_BILINEAR)
            .getBufferAsync(MIME_JPEG);
        return {
            buffer,
            original: dimensions
        };
    }
    else {
        throw new boom_1.Boom('No image processing library available');
    }
};
exports.extractImageThumb = extractImageThumb;
const encodeBase64EncodedStringForUpload = (b64) => (encodeURIComponent(b64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/\=+$/, '')));
exports.encodeBase64EncodedStringForUpload = encodeBase64EncodedStringForUpload;
const generateProfilePicture = async (mediaUpload) => {
    let bufferOrFilePath;
    let img;
    if (Buffer.isBuffer(mediaUpload)) {
        bufferOrFilePath = mediaUpload;
    }
    else if ('url' in mediaUpload) {
        bufferOrFilePath = mediaUpload.url.toString();
    }
    else {
        bufferOrFilePath = await (0, exports.toBuffer)(mediaUpload.stream);
    }
    const jimp = await jimp_1.default.read(bufferOrFilePath);
    const cropped = jimp.getWidth() > jimp.getHeight() ? jimp.resize(550, -1) : jimp.resize(-1, 650);
    img = cropped
        .quality(100)
        .getBufferAsync(jimp_1.default.MIME_JPEG);
    return {
        img: await img,
    };
};
exports.generateProfilePicture = generateProfilePicture;
/** gets the SHA256 of the given media message */
const mediaMessageSHA256B64 = (message) => {
    const media = Object.values(message)[0];
    return (media === null || media === void 0 ? void 0 : media.fileSha256) && Buffer.from(media.fileSha256).toString('base64');
};
exports.mediaMessageSHA256B64 = mediaMessageSHA256B64;
async function getAudioDuration(buffer) {
    const musicMetadata = await Promise.resolve().then(() => __importStar(require('music-metadata')));
    let metadata;
    const options = {
        duration: true
    };
    if (Buffer.isBuffer(buffer)) {
        metadata = await musicMetadata.parseBuffer(buffer, undefined, options);
    }
    else if (typeof buffer === 'string') {
        metadata = await musicMetadata.parseFile(buffer, options);
    }
    else {
        metadata = await musicMetadata.parseStream(buffer, undefined, options);
    }
    return metadata.format.duration;
}
/**
  referenced from and modifying https://github.com/wppconnect-team/wa-js/blob/main/src/chat/functions/prepareAudioWaveform.ts
 */
async function getAudioWaveform(buffer, logger) {
    try {
        const { default: decoder } = await eval('import(\'audio-decode\')');
        let audioData;
        if (Buffer.isBuffer(buffer)) {
            audioData = buffer;
        }
        else if (typeof buffer === 'string') {
            const rStream = (0, fs_1.createReadStream)(buffer);
            audioData = await (0, exports.toBuffer)(rStream);
        }
        else {
            audioData = await (0, exports.toBuffer)(buffer);
        }
        const audioBuffer = await decoder(audioData);
        const rawData = audioBuffer.getChannelData(0); // We only need to work with one channel of data
        const samples = 64; // Number of samples we want to have in our final data set
        const blockSize = Math.floor(rawData.length / samples); // the number of samples in each subdivision
        const filteredData = [];
        for (let i = 0; i < samples; i++) {
            const blockStart = blockSize * i; // the location of the first sample in the block
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum = sum + Math.abs(rawData[blockStart + j]); // find the sum of all the samples in the block
            }
            filteredData.push(sum / blockSize); // divide the sum by the block size to get the average
        }
        // This guarantees that the largest data point will be set to 1, and the rest of the data will scale proportionally.
        const multiplier = Math.pow(Math.max(...filteredData), -1);
        const normalizedData = filteredData.map((n) => n * multiplier);
        // Generate waveform like WhatsApp
        const waveform = new Uint8Array(normalizedData.map((n) => Math.floor(100 * n)));
        return waveform;
    }
    catch (e) {
        logger === null || logger === void 0 ? void 0 : logger.debug('Failed to generate waveform: ' + e);
    }
}
const toReadable = (buffer) => {
    const readable = new stream_1.Readable({ read: () => { } });
    readable.push(buffer);
    readable.push(null);
    return readable;
};
exports.toReadable = toReadable;
const toBuffer = async (stream) => {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    stream.destroy();
    return Buffer.concat(chunks);
};
exports.toBuffer = toBuffer;
const getStream = async (item, opts) => {
    if (Buffer.isBuffer(item)) {
        return { stream: (0, exports.toReadable)(item), type: 'buffer' };
    }
    if ('stream' in item) {
        return { stream: item.stream, type: 'readable' };
    }
    if (item.url.toString().startsWith('http://') || item.url.toString().startsWith('https://')) {
        return { stream: await (0, exports.getHttpStream)(item.url, opts), type: 'remote' };
    }
    return { stream: (0, fs_1.createReadStream)(item.url), type: 'file' };
};
exports.getStream = getStream;
/** generates a thumbnail for a given media, if required */
async function generateThumbnail(file, mediaType, options) {
    var _a;
    let thumbnail;
    let originalImageDimensions;
    if (mediaType === 'image') {
        const { buffer, original } = await (0, exports.extractImageThumb)(file);
        thumbnail = buffer.toString('base64');
        if (original.width && original.height) {
            originalImageDimensions = {
                width: original.width,
                height: original.height,
            };
        }
    }
    else if (mediaType === 'video') {
        try {
            const thumbnailBuffer = await (0, exports.extractVideoThumb)(file);
            const imgFilename = (0, path_1.join)(getTmpFilesDirectory(), (0, generics_1.generateMessageIDV2)() + '.jpg');
            await fs_1.promises.writeFile(imgFilename, thumbnailBuffer);
            const { buffer: processedThumbnailBuffer, original } = await (0, exports.extractImageThumb)(imgFilename);
            thumbnail = processedThumbnailBuffer.toString('base64');
            if (original.width && original.height) {
                originalImageDimensions = {
                    width: original.width,
                    height: original.height,
                };
            }
            await fs_1.promises.unlink(imgFilename);
        }
        catch (err) {
            (_a = options.logger) === null || _a === void 0 ? void 0 : _a.debug('could not generate video thumb: ' + err);
        }
    }
    return {
        thumbnail,
        originalImageDimensions
    };
}
const getHttpStream = async (url, options = {}) => {
    const fetched = await axios_1.default.get(url.toString(), { ...options, responseType: 'stream' });
    return fetched.data;
};
exports.getHttpStream = getHttpStream;
const prepareStream = async (media, mediaType, { logger, saveOriginalFileIfRequired, opts } = {}) => {
    const { stream, type } = await (0, exports.getStream)(media, opts);
    logger === null || logger === void 0 ? void 0 : logger.debug('fetched media stream');
    let bodyPath;
    let didSaveToTmpPath = false;
    try {
        const buffer = await (0, exports.toBuffer)(stream);
        if (type === 'file') {
            bodyPath = media.url;
        }
        else if (saveOriginalFileIfRequired) {
            bodyPath = (0, path_1.join)(getTmpFilesDirectory(), mediaType + (0, generics_1.generateMessageIDV2)());
            (0, fs_1.writeFileSync)(bodyPath, buffer);
            didSaveToTmpPath = true;
        }
        const fileLength = buffer.length;
        const fileSha256 = Crypto.createHash('sha256').update(buffer).digest();
        stream === null || stream === void 0 ? void 0 : stream.destroy();
        logger === null || logger === void 0 ? void 0 : logger.debug('prepare stream data successfully');
        return {
            mediaKey: undefined,
            encWriteStream: buffer,
            fileLength,
            fileSha256,
            fileEncSha256: undefined,
            bodyPath,
            didSaveToTmpPath
        };
    }
    catch (error) {
        // destroy all streams with error
        stream.destroy();
        if (didSaveToTmpPath) {
            try {
                await fs_1.promises.unlink(bodyPath);
            }
            catch (err) {
                logger === null || logger === void 0 ? void 0 : logger.error({ err }, 'failed to save to tmp path');
            }
        }
        throw error;
    }
};
exports.prepareStream = prepareStream;
const encryptedStream = async (media, mediaType, { logger, saveOriginalFileIfRequired, opts } = {}) => {
    const { stream, type } = await (0, exports.getStream)(media, opts);
    logger === null || logger === void 0 ? void 0 : logger.debug('fetched media stream');
    const mediaKey = Crypto.randomBytes(32);
    const { cipherKey, iv, macKey } = await getMediaKeys(mediaKey, mediaType);
    const encWriteStream = new stream_1.Readable({ read: () => { } });
    let bodyPath;
    let writeStream;
    let didSaveToTmpPath = false;
    if (type === 'file') {
        bodyPath = media.url;
    }
    else if (saveOriginalFileIfRequired) {
        bodyPath = (0, path_1.join)(getTmpFilesDirectory(), mediaType + (0, generics_1.generateMessageIDV2)());
        writeStream = (0, fs_1.createWriteStream)(bodyPath);
        didSaveToTmpPath = true;
    }
    let fileLength = 0;
    const aes = Crypto.createCipheriv('aes-256-cbc', cipherKey, iv);
    let hmac = Crypto.createHmac('sha256', macKey).update(iv);
    let sha256Plain = Crypto.createHash('sha256');
    let sha256Enc = Crypto.createHash('sha256');
    try {
        for await (const data of stream) {
            fileLength += data.length;
            if (type === 'remote'
                && (opts === null || opts === void 0 ? void 0 : opts.maxContentLength)
                && fileLength + data.length > opts.maxContentLength) {
                throw new boom_1.Boom(`content length exceeded when encrypting "${type}"`, {
                    data: { media, type }
                });
            }
            sha256Plain = sha256Plain.update(data);
            if (writeStream) {
                if (!writeStream.write(data)) {
                    await (0, events_1.once)(writeStream, 'drain');
                }
            }
            onChunk(aes.update(data));
        }
        onChunk(aes.final());
        const mac = hmac.digest().slice(0, 10);
        sha256Enc = sha256Enc.update(mac);
        const fileSha256 = sha256Plain.digest();
        const fileEncSha256 = sha256Enc.digest();
        encWriteStream.push(mac);
        encWriteStream.push(null);
        writeStream === null || writeStream === void 0 ? void 0 : writeStream.end();
        stream.destroy();
        logger === null || logger === void 0 ? void 0 : logger.debug('encrypted data successfully');
        return {
            mediaKey,
            encWriteStream,
            bodyPath,
            mac,
            fileEncSha256,
            fileSha256,
            fileLength,
            didSaveToTmpPath
        };
    }
    catch (error) {
        // destroy all streams with error
        encWriteStream.destroy();
        writeStream === null || writeStream === void 0 ? void 0 : writeStream.destroy();
        aes.destroy();
        hmac.destroy();
        sha256Plain.destroy();
        sha256Enc.destroy();
        stream.destroy();
        if (didSaveToTmpPath) {
            try {
                await fs_1.promises.unlink(bodyPath);
            }
            catch (err) {
                logger === null || logger === void 0 ? void 0 : logger.error({ err }, 'failed to save to tmp path');
            }
        }
        throw error;
    }
    function onChunk(buff) {
        sha256Enc = sha256Enc.update(buff);
        hmac = hmac.update(buff);
        encWriteStream.push(buff);
    }
};
exports.encryptedStream = encryptedStream;
const DEF_HOST = 'mmg.whatsapp.net';
const AES_CHUNK_SIZE = 16;
const toSmallestChunkSize = (num) => {
    return Math.floor(num / AES_CHUNK_SIZE) * AES_CHUNK_SIZE;
};
const getUrlFromDirectPath = (directPath) => `https://${DEF_HOST}${directPath}`;
exports.getUrlFromDirectPath = getUrlFromDirectPath;
const downloadContentFromMessage = async ({ mediaKey, directPath, url }, type, opts = {}) => {
    const isValidMediaUrl = url === null || url === void 0 ? void 0 : url.startsWith('https://mmg.whatsapp.net/');
    const downloadUrl = isValidMediaUrl ? url : (0, exports.getUrlFromDirectPath)(directPath);
    if (!downloadUrl) {
        throw new boom_1.Boom('No valid media URL or directPath present in message', { statusCode: 400 });
    }
    const keys = await getMediaKeys(mediaKey, type);
    return (0, exports.downloadEncryptedContent)(downloadUrl, keys, opts);
};
exports.downloadContentFromMessage = downloadContentFromMessage;
/**
 * Decrypts and downloads an AES256-CBC encrypted file given the keys.
 * Assumes the SHA256 of the plaintext is appended to the end of the ciphertext
 * */
const downloadEncryptedContent = async (downloadUrl, { cipherKey, iv }, { startByte, endByte, options } = {}) => {
    let bytesFetched = 0;
    let startChunk = 0;
    let firstBlockIsIV = false;
    // if a start byte is specified -- then we need to fetch the previous chunk as that will form the IV
    if (startByte) {
        const chunk = toSmallestChunkSize(startByte || 0);
        if (chunk) {
            startChunk = chunk - AES_CHUNK_SIZE;
            bytesFetched = chunk;
            firstBlockIsIV = true;
        }
    }
    const endChunk = endByte ? toSmallestChunkSize(endByte || 0) + AES_CHUNK_SIZE : undefined;
    const headers = {
        ...(options === null || options === void 0 ? void 0 : options.headers) || {},
        Origin: Defaults_1.DEFAULT_ORIGIN,
    };
    if (startChunk || endChunk) {
        headers.Range = `bytes=${startChunk}-`;
        if (endChunk) {
            headers.Range += endChunk;
        }
    }
    // download the message
    const fetched = await (0, exports.getHttpStream)(downloadUrl, {
        ...options || {},
        headers,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
    });
    let remainingBytes = Buffer.from([]);
    let aes;
    const pushBytes = (bytes, push) => {
        if (startByte || endByte) {
            const start = bytesFetched >= startByte ? undefined : Math.max(startByte - bytesFetched, 0);
            const end = bytesFetched + bytes.length < endByte ? undefined : Math.max(endByte - bytesFetched, 0);
            push(bytes.slice(start, end));
            bytesFetched += bytes.length;
        }
        else {
            push(bytes);
        }
    };
    const output = new stream_1.Transform({
        transform(chunk, _, callback) {
            let data = Buffer.concat([remainingBytes, chunk]);
            const decryptLength = toSmallestChunkSize(data.length);
            remainingBytes = data.slice(decryptLength);
            data = data.slice(0, decryptLength);
            if (!aes) {
                let ivValue = iv;
                if (firstBlockIsIV) {
                    ivValue = data.slice(0, AES_CHUNK_SIZE);
                    data = data.slice(AES_CHUNK_SIZE);
                }
                aes = Crypto.createDecipheriv('aes-256-cbc', cipherKey, ivValue);
                // if an end byte that is not EOF is specified
                // stop auto padding (PKCS7) -- otherwise throws an error for decryption
                if (endByte) {
                    aes.setAutoPadding(false);
                }
            }
            try {
                pushBytes(aes.update(data), b => this.push(b));
                callback();
            }
            catch (error) {
                callback(error);
            }
        },
        final(callback) {
            try {
                pushBytes(aes.final(), b => this.push(b));
                callback();
            }
            catch (error) {
                callback(error);
            }
        },
    });
    return fetched.pipe(output, { end: true });
};
exports.downloadEncryptedContent = downloadEncryptedContent;
function extensionForMediaMessage(message) {
    const getExtension = (mimetype) => mimetype.split(';')[0].split('/')[1];
    const type = Object.keys(message)[0];
    let extension;
    if (type === 'locationMessage' ||
        type === 'liveLocationMessage' ||
        type === 'productMessage') {
        extension = '.jpeg';
    }
    else {
        const messageContent = message[type];
        extension = getExtension(messageContent.mimetype);
    }
    return extension;
}
const getWAUploadToServer = ({ customUploadHosts, fetchAgent, logger, options }, refreshMediaConn) => {
    return async (stream, { mediaType, fileEncSha256B64, newsletter, timeoutMs }) => {
        var _a, _b;
        // send a query JSON to obtain the url & auth token to upload our media
        let uploadInfo = await refreshMediaConn(false);
        let urls;
        const hosts = [...customUploadHosts, ...uploadInfo.hosts];
        const chunks = [];
        if (!Buffer.isBuffer(stream)) {
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
        }
        const reqBody = Buffer.isBuffer(stream) ? stream : Buffer.concat(chunks);
        fileEncSha256B64 = (0, exports.encodeBase64EncodedStringForUpload)(fileEncSha256B64);
        let media = Defaults_1.MEDIA_PATH_MAP[mediaType];
        if (newsletter) {
            media = media === null || media === void 0 ? void 0 : media.replace('/mms/', '/newsletter/newsletter-');
        }
        for (const { hostname, maxContentLengthBytes } of hosts) {
            logger.debug(`uploading to "${hostname}"`);
            const auth = encodeURIComponent(uploadInfo.auth); // the auth token
            const url = `https://${hostname}${media}/${fileEncSha256B64}?auth=${auth}&token=${fileEncSha256B64}`;
            let result;
            try {
                if (maxContentLengthBytes && reqBody.length > maxContentLengthBytes) {
                    throw new boom_1.Boom(`Body too large for "${hostname}"`, { statusCode: 413 });
                }
                const body = await axios_1.default.post(url, reqBody, {
                    ...options,
                    headers: {
                        ...options.headers || {},
                        'Content-Type': 'application/octet-stream',
                        'Origin': Defaults_1.DEFAULT_ORIGIN
                    },
                    httpsAgent: fetchAgent,
                    timeout: timeoutMs,
                    responseType: 'json',
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity,
                });
                result = body.data;
                if ((result === null || result === void 0 ? void 0 : result.url) || (result === null || result === void 0 ? void 0 : result.directPath)) {
                    urls = {
                        mediaUrl: result.url,
                        directPath: result.direct_path,
                        handle: result.handle
                    };
                    break;
                }
                else {
                    uploadInfo = await refreshMediaConn(true);
                    throw new Error(`upload failed, reason: ${JSON.stringify(result)}`);
                }
            }
            catch (error) {
                if (axios_1.default.isAxiosError(error)) {
                    result = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data;
                }
                const isLast = hostname === ((_b = hosts[uploadInfo.hosts.length - 1]) === null || _b === void 0 ? void 0 : _b.hostname);
                logger.warn({ trace: error.stack, uploadResult: result }, `Error in uploading to ${hostname} ${isLast ? '' : ', retrying...'}`);
            }
        }
        if (!urls) {
            throw new boom_1.Boom('Media upload failed on all hosts', { statusCode: 500 });
        }
        return urls;
    };
};
exports.getWAUploadToServer = getWAUploadToServer;
const getMediaRetryKey = (mediaKey) => {
    return (0, crypto_1.hkdf)(mediaKey, 32, { info: 'WhatsApp Media Retry Notification' });
};
/**
 * Generate a binary node that will request the phone to re-upload the media & return the newly uploaded URL
 */
const encryptMediaRetryRequest = async (key, mediaKey, meId) => {
    const recp = { stanzaId: key.id };
    const recpBuffer = WAProto_1.proto.ServerErrorReceipt.encode(recp).finish();
    const iv = Crypto.randomBytes(12);
    const retryKey = await getMediaRetryKey(mediaKey);
    const ciphertext = (0, crypto_1.aesEncryptGCM)(recpBuffer, retryKey, iv, Buffer.from(key.id));
    const req = {
        tag: 'receipt',
        attrs: {
            id: key.id,
            to: (0, WABinary_1.jidNormalizedUser)(meId),
            type: 'server-error'
        },
        content: [
            // this encrypt node is actually pretty useless
            // the media is returned even without this node
            // keeping it here to maintain parity with WA Web
            {
                tag: 'encrypt',
                attrs: {},
                content: [
                    { tag: 'enc_p', attrs: {}, content: ciphertext },
                    { tag: 'enc_iv', attrs: {}, content: iv }
                ]
            },
            {
                tag: 'rmr',
                attrs: {
                    jid: key.remoteJid,
                    'from_me': (!!key.fromMe).toString(),
                    // @ts-ignore
                    participant: key.participant || undefined
                }
            }
        ]
    };
    return req;
};
exports.encryptMediaRetryRequest = encryptMediaRetryRequest;
const decodeMediaRetryNode = (node) => {
    const rmrNode = (0, WABinary_1.getBinaryNodeChild)(node, 'rmr');
    const event = {
        key: {
            id: node.attrs.id,
            remoteJid: rmrNode.attrs.jid,
            fromMe: rmrNode.attrs.from_me === 'true',
            participant: rmrNode.attrs.participant
        }
    };
    const errorNode = (0, WABinary_1.getBinaryNodeChild)(node, 'error');
    if (errorNode) {
        const errorCode = +errorNode.attrs.code;
        event.error = new boom_1.Boom(`Failed to re-upload media (${errorCode})`, { data: errorNode.attrs, statusCode: (0, exports.getStatusCodeForMediaRetry)(errorCode) });
    }
    else {
        const encryptedInfoNode = (0, WABinary_1.getBinaryNodeChild)(node, 'encrypt');
        const ciphertext = (0, WABinary_1.getBinaryNodeChildBuffer)(encryptedInfoNode, 'enc_p');
        const iv = (0, WABinary_1.getBinaryNodeChildBuffer)(encryptedInfoNode, 'enc_iv');
        if (ciphertext && iv) {
            event.media = { ciphertext, iv };
        }
        else {
            event.error = new boom_1.Boom('Failed to re-upload media (missing ciphertext)', { statusCode: 404 });
        }
    }
    return event;
};
exports.decodeMediaRetryNode = decodeMediaRetryNode;
const decryptMediaRetryData = async ({ ciphertext, iv }, mediaKey, msgId) => {
    const retryKey = await getMediaRetryKey(mediaKey);
    const plaintext = (0, crypto_1.aesDecryptGCM)(ciphertext, retryKey, iv, Buffer.from(msgId));
    return WAProto_1.proto.MediaRetryNotification.decode(plaintext);
};
exports.decryptMediaRetryData = decryptMediaRetryData;
const getStatusCodeForMediaRetry = (code) => MEDIA_RETRY_STATUS_MAP[code];
exports.getStatusCodeForMediaRetry = getStatusCodeForMediaRetry;
const MEDIA_RETRY_STATUS_MAP = {
    [WAProto_1.proto.MediaRetryNotification.ResultType.SUCCESS]: 200,
    [WAProto_1.proto.MediaRetryNotification.ResultType.DECRYPTION_ERROR]: 412,
    [WAProto_1.proto.MediaRetryNotification.ResultType.NOT_FOUND]: 404,
    [WAProto_1.proto.MediaRetryNotification.ResultType.GENERAL_ERROR]: 418,
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function __importStar(arg0) {
    throw new Error('Function not implemented.');
}
