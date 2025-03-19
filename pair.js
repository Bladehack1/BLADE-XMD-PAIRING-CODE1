const PastebinAPI = require('pastebin-js'),
      pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL')
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
    fs.rmSync(FilePath, { recursive: true, force: true })
}

router.get('/', async (req, res) => {
    const id = makeid();  // Generate unique session ID
    const name = "𝑫𝑶𝑵 𝑻𝑬𝑪𝑯";  // Your name to be added to the session ID
    const sessionID = `${blade-TECH}_${id}`;  // Append your name to the session ID
    let num = req.query.number;

    async function getPaire() {
        const {
            state,
            saveCreds
        } = await useMultiFileAuthState('./temp/' + sessionID);

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
                    await res.send({ code });
                }
            }

            session.ev.on('creds.update', saveCreds);
            session.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection == "open") {
                    await delay(10000);
                    await delay(10000);
                    const output = await pastebin.createPasteFromFile(__dirname + `/temp/${sessionID}/creds.json`, "pastebin-js test", null, 1, "N");

                    // First message: Send the session ID to the user
                    await session.sendMessage(session.user.id, {
                        text: `${sessionID}`  // Send the session ID
                    });

                   
                    // second message: Send the confirmation message
                    await session.sendMessage(session.user.id, {
                        text: `Session created successfully ✅`
                    });

                    await delay(100);
                    await session.ws.close();
                    return await removeFile('./temp/' + sessionID);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    getPaire();
                }
            });
        } catch (err) {
            console.log("service restarted");
            await removeFile('./temp/' + sessionID);
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
        }
    }

    return await getPaire();
});

module.exports = router;
