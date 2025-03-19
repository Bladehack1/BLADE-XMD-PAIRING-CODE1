const express = require('express');
const QRCode = require('qrcode');
const PastebinAPI = require('pastebin-js');
const pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL');
const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

// Initialize Express Router
let router = express.Router();

// Generate Random ID for the session (the `makeid` function)
function makeid(length = 50) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
        counter += 1;
    }
    return result;
}

// Remove temporary files (credentials)
function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

// Main route to get QR Code for WhatsApp Web
router.get('/', async (req, res) => {
    const id = makeid();  // Generate a unique random session ID
    const name = "GlobalTechInfo";  // Your name to add to the session ID
    const sessionID = `${name}_${id}`;  // Format the session ID as 'GlobalTechInfo_<randomID>'

    async function Getqr() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + sessionID);  // Use the updated session ID

        try {
            let session = makeWASocket({
                auth: state,
                printQRInTerminal: false,  // Disable terminal output
                logger: pino({ level: 'silent' }),  // Disable logging
                browser: ['Windows', 'Chrome', '20.0.04'],
            });

            session.ev.on('creds.update', saveCreds);

            session.ev.on('connection.update', async (s) => {
                const { connection, lastDisconnect, qr } = s;

                if (qr) {
                    // Ensure the response is only sent once
                    if (!res.headersSent) {
                        res.setHeader('Content-Type', 'image/png');
                        try {
                            const qrBuffer = await QRCode.toBuffer(qr);  // Convert QR to buffer
                            res.end(qrBuffer);  // Send the buffer as the response
                            return; // Exit the function to avoid sending further responses
                        } catch (error) {
                            console.error("Error generating QR Code buffer:", error);
                            if (!res.headersSent) {
                                res.status(500).json({ message: "Error generating QR code" });
                            }
                            return; // Exit after sending the error response
                        }
                    }
                }

                // If the connection is open (successful login)
                if (connection === 'open') {
                    await delay(10000);  // Wait for a while before creating paste
                    const output = await pastebin.createPasteFromFile(
                        path.join(__dirname, `temp/${sessionID}/creds.json`),  // Use the updated session ID
                        "pastebin-js test", 
                        null, 1, "N"
                    );
                    await session.sendMessage(session.user.id, {
                        text: `${sessionID}`  // Send the session ID first
                    });

                    // Send confirmation message after session is created
                    await session.sendMessage(session.user.id, {
                        text: `Session created successfully ✅`
                    });

                    await delay(100);
                    await session.ws.close();  // Close the WebSocket connection
                    await removeFile(path.join('temp', sessionID));  // Clean up the temporary session files
                } else if (connection === 'close' && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    // If the connection is unexpectedly closed, retry
                    await delay(10000);
                    // Only retry if no response has been sent yet
                    if (!res.headersSent) {
                        await Getqr();
                    }
                }
            });

        } catch (err) {
            if (!res.headersSent) {
                res.status(500).json({
                    code: 'Service Unavailable',
                    error: err.message
                });
            }
            console.error('Error in session creation:', err);
            await removeFile(path.join('temp', sessionID));  // Clean up on error
        }
    }

    // Start generating the QR code
    await Getqr();
});

// Export the router to be used in your Express app
module.exports = router;
                                      
