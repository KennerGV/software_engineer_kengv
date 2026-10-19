import { onRequest } from "firebase-functions/v2/https";

let ssrApp;

export const ssrServer = onRequest({
    region: "us-central1", 
    memory: "256MiB",
    cors: true,       
}, async (req, res) => {
    if (!ssrApp) {
        ssrApp = await import("./dist/server/entry.mjs");
    }
    return ssrApp.handler(req, res);
});