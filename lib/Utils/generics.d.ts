import { AxiosRequestConfig } from 'axios';
import { ILogger } from './logger';
import { proto } from '../../WAProto';
import { BaileysEventEmitter, BaileysEventMap, BrowsersMap, WACallUpdateType, WAVersion } from '../Types';
import { BinaryNode } from '../WABinary';
export declare const Browsers: BrowsersMap;
export declare const getPlatformId: (browser: string) => any;
export declare const BufferJSON: {
    replacer: (k: any, value: any) => any;
    reviver: (_: any, value: any) => any;
};
export declare const getKeyAuthor: (key: proto.IMessageKey | undefined | null, meId?: string) => string;
export declare const writeRandomPadMax16: (msg: Uint8Array) => any;
export declare const unpadRandomMax16: (e: Uint8Array | Buffer) => Uint8Array<any>;
export declare const encodeWAMessage: (message: proto.IMessage) => any;
export declare const encodeNewsletterMessage: (message: proto.IMessage) => any;
export declare const generateRegistrationId: () => number;
export declare const encodeBigEndian: (e: number, t?: number) => Uint8Array<ArrayBuffer>;
export declare const toNumber: (t: Long | number | null | undefined) => number;
/** unix timestamp of a date in seconds */
export declare const unixTimestampSeconds: (date?: Date) => number;
export type DebouncedTimeout = ReturnType<typeof debouncedTimeout>;
export declare const debouncedTimeout: (intervalMs?: number, task?: () => void) => {
    start: (newIntervalMs?: number, newTask?: () => void) => void;
    cancel: () => void;
    setTask: (newTask: () => void) => () => void;
    setInterval: (newInterval: number) => number;
};
export declare const delay: (ms: number) => Promise<void>;
export declare const delayCancellable: (ms: number) => {
    delay: Promise<void>;
    cancel: () => void;
};
export declare function promiseTimeout<T>(ms: number | undefined, promise: (resolve: (v: T) => void, reject: (error: any) => void) => void): Promise<T>;
export declare const generateMessageIDV2: (userId?: string) => string;
export declare const generateMessageID: () => string;
export declare function bindWaitForEvent<T extends keyof BaileysEventMap>(ev: BaileysEventEmitter, event: T): (check: (u: BaileysEventMap[T]) => Promise<boolean | undefined>, timeoutMs?: number) => Promise<void>;
export declare const bindWaitForConnectionUpdate: (ev: BaileysEventEmitter) => (check: (u: Partial<import("../Types").ConnectionState>) => Promise<boolean | undefined>, timeoutMs?: number) => Promise<void>;
export declare const printQRIfNecessaryListener: (ev: BaileysEventEmitter, logger: ILogger) => void;
/**
 * utility that fetches latest baileys version from the master branch.
 * Use to ensure your WA connection is always on the latest version
 */
export declare const fetchLatestBaileysVersion: (options?: AxiosRequestConfig<any>) => Promise<{
    version: any;
    isLatest: boolean;
    error?: undefined;
} | {
    version: WAVersion;
    isLatest: boolean;
    error: any;
}>;
/**
 * A utility that fetches the latest web version of whatsapp.
 * Use to ensure your WA connection is always on the latest version
 */
export declare const fetchLatestWaWebVersion: (options: AxiosRequestConfig<{}>) => Promise<{
    version: WAVersion;
    isLatest: boolean;
    error?: undefined;
} | {
    version: WAVersion;
    isLatest: boolean;
    error: any;
}>;
/** unique message tag prefix for MD clients */
export declare const generateMdTagPrefix: () => string;
/**
 * Given a type of receipt, returns what the new status of the message should be
 * @param type type from receipt
 */
export declare const getStatusFromReceiptType: (type: string | undefined) => proto.WebMessageInfo.Status;
/**
 * Stream errors generally provide a reason, map that to a baileys DisconnectReason
 * @param reason the string reason given, eg. "conflict"
 */
export declare const getErrorCodeFromStreamError: (node: BinaryNode) => {
    reason: string;
    statusCode: number;
};
export declare const getCallStatusFromNode: ({ tag, attrs }: BinaryNode) => WACallUpdateType;
export declare const getCodeFromWSError: (error: Error) => number;
/**
 * Is the given platform WA business
 * @param platform AuthenticationCreds.platform
 */
export declare const isWABusinessPlatform: (platform: string) => platform is "smba" | "smbi";
export declare function trimUndefined(obj: any): any;
export declare function bytesToCrockford(buffer: Buffer): string;
