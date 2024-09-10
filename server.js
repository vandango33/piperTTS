const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Middleware to check API key
app.use((req, res, next) => {
  const apiKey = process.env.PIPER_API_KEY;
  const authHeader = req.headers['authorization'];

  if (!authHeader || authHeader.split(' ')[1] !== apiKey) {
      return res.status(403).json({ error: 'Forbidden: Invalid or missing API key' });
  }

  next();
});

app.post('/synthesize', (req, res) => {
    const { input, voice } = req.body;

    if (!input || !voice) {
        return res.status(400).json({ error: 'Missing input text or voice model' });
    }

    const wavFilePath = path.join(__dirname, 'output.wav');
    const mp3FilePath = path.join(__dirname, 'output.mp3');
    const modelPath = path.join(__dirname, 'voices', `${voice}.onnx`);

    // Run Piper command
    const piperCommand = `echo "${input}" | /app/piper/piper --model ${modelPath} --output_file ${wavFilePath}`;
    
    console.log(`Executing command: ${piperCommand}`);
    
    exec(piperCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error generating WAV: ${error.message}`);
            return res.status(500).json({ error: 'Failed to synthesize audio' });
        }

        // Convert WAV to MP3 using ffmpeg
        const ffmpegCommand = `ffmpeg -i ${wavFilePath} -codec:a libmp3lame -qscale:a 2 ${mp3FilePath}`;
        
        exec(ffmpegCommand, (ffmpegError) => {
            if (ffmpegError) {
                console.error(`Error converting to MP3: ${ffmpegError.message}`);
                return res.status(500).json({ error: 'Failed to convert audio to MP3' });
            }

            // Send the MP3 file back to the client
            res.sendFile(mp3FilePath, (err) => {
                if (err) {
                    console.error(`Error sending MP3 file: ${err.message}`);
                }
                // Clean up the files after sending
                fs.unlink(wavFilePath, (err) => {
                    if (err) console.error(`Error deleting WAV file: ${err.message}`);
                });
                fs.unlink(mp3FilePath, (err) => {
                    if (err) console.error(`Error deleting MP3 file: ${err.message}`);
                });
            });
        });
    });
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
