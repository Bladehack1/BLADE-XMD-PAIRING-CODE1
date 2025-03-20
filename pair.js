const PastebinAPI = require('pastebin-js'),
      pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL');
const { makeid } = require('./id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();  
    const sessionID = `BLADE-TECH_${id}`;  
    let num = req.query.number;

    async function getPair() {
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
                num = num.replace(/[^0-9]/g, '');
                const code = await session.requestPairingCode(num);

                if (!res.headersSent) {
                    res.json({ code, sessionID });
                }
            }

            session.ev.on('creds.update', saveCreds);
            session.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === "open") {
                    await delay(10000);
                    await pastebin.createPasteFromFile(__dirname + `/temp/${sessionID}/creds.json`, "pastebin-js test", null, 1, "N");

                    await session.sendMessage(session.user.id, {
                        text: `Session ID: ${sessionID}`
                    });

                    await delay(100);
                    await session.ws.close();
                    removeFile('./temp/' + sessionID);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    await delay(10000);
                    getPair();
                }
            });
        } catch (err) {
            console.log("Service restarted");
            removeFile('./temp/' + sessionID);
            if (!res.headersSent) {
                res.json({ code: "Service Unavailable", sessionID: null });
            }
        }
    }

    return await getPair();
});

module.exports = router;
