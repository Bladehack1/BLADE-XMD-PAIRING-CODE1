const PastebinAPI = require('pastebin-js');
const pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL');
const { makeid } = require('./id');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

let router = express.Router();

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    const sessionID = `blade-TECH_${id}`;
    let num = req.query.number;

    if (!num) {
        return res.status(400).json({ error: "Number parameter is required" });
    }
    num = num.replace(/[^0-9]/g, '');  

    async function getPaire() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + sessionID);

        try {
            let session = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: ["Windows", "Chrome", "20.0.04"],
            });

            if (!session.authState.creds.registered) {
                await delay(1500);
                try {
                    const code = await session.requestPairingCode(num);
                    if (!res.headersSent) {
                        res.json({ code });
                    }
                } catch (error) {
                    console.error("Error generating pairing code:", error);
                    if (!res.headersSent) {
                        res.status(500).json({ error: "Failed to generate pairing code" });
                    }
                    return;
                }
            }

            session.ev.on('creds.update', saveCreds);
            session.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection == "open") {
                    await delay(20000);

                    const filePath = path.join(__dirname, `temp/${sessionID}/creds.json`);
                    if (!fs.existsSync(filePath)) {
                        console.error("Session file not found:", filePath);
                        return;
                    }

                    try {
                        const output = await pastebin.createPasteFromFile(filePath, "pastebin-js test", null, 1, "N");

                        await session.sendMessage(session.user.id, { text: `${sessionID}` });
                        await session.sendMessage(session.user.id, { text: `Session created successfully ✅` });

                        await delay(100);
                        await session.ws.close();
                        removeFile('./temp/' + sessionID);
                    } catch (error) {
                        console.error("Error uploading session file to Pastebin:", error);
                    }
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    getPaire();
                }
            });
        } catch (err) {
            console.log("Service restarted");
            removeFile('./temp/' + sessionID);
            if (!res.headersSent) {
                res.status(500).json({ error: "Service Unavailable" });
            }
        }
    }

    return await getPaire();
});

module.exports = router;
