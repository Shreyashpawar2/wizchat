const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cors = require('cors');
const qrcodeLib = require('qrcode');
const app = express();
const PORT = process.env.PORT || 3000;
const { MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const BadWords = require('bad-words'); // Import the bad-words library
const badWordFilter = new BadWords();
app.use(cors());
app.use(bodyParser.json());

const client = new Client();

app.get('/qrcode', (req, res) => {
    client.on('qr', qr => {
        qrcodeLib.toDataURL(qr, (err, url) => {
            if (err) {
                console.error('Error generating QR code:', err);
                res.status(500).json({ message: 'An error occurred while generating the QR code.' });
            } else {
                res.send(url); // Send the QR code image data as the response
            }
        });
    });
    client.initialize();
});

app.post('/send', async (req, res) => {
    const { numbers, message } = req.body;

    if (!Array.isArray(numbers)) {
        return res.status(400).json({ message: 'Invalid numbers format. Please provide an array of numbers.' });
    }

    try {
        const promises = numbers.map(async number => {
            // Check for harmful content in the message
            if (badWordFilter.isProfane(message)) {
                // Handle harmful content case
                console.log(`Harmful content detected in message to ${number}`);
                return;
            }

            // Separate the image URL and message text
            const [textMessage, imageUrl] = message.split('<img src="');
            
            // Download the image and convert it to base64
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imageBase64 = Buffer.from(imageResponse.data, 'binary').toString('base64');

            // Create the MessageMedia object for the image
            const media = new MessageMedia('image/png', imageBase64, 'image.png');

            // Send the image as a media attachment
            await client.sendMessage(number.trim() + '@c.us', media);

            // Send the text message
            if (textMessage) {
                await client.sendMessage(number.trim() + '@c.us', textMessage);
            }
        });

        await Promise.all(promises);
        res.json({ message: 'Messages sent successfully!' });
    } catch (error) {
        console.error('Error sending messages:', error);
        res.status(500).json({ message: 'An error occurred while sending messages.' });
    }
});
app.get('/status', (req, res) => {
    const isClientAuthenticated = client.isReady; // Check if the client is authenticated
    res.send('Client authenticated');
});

client.on('authenticated', () => {
    console.log('Client authenticated');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
