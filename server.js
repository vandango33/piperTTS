const express = require('express');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

let piperProcess;

// Log time helper
const logTime = (label, startTime) => {
    const endTime = Date.now();
    console.log(`${label} took ${endTime - startTime} ms`);
};

// Middleware to check API key
app.use((req, res, next) => {
    const apiKey = process.env.PIPER_API_KEY;
    const authHeader = req.headers['authorization'];

    if (!authHeader || authHeader.split(' ')[1] !== apiKey) {
        return res.status(403).json({ error: 'Forbidden: Invalid or missing API key' });
    }

    next();
});

// Preload Piper model on server start
const preloadPiperModel = (voiceModelPath) => {
    piperProcess = spawn('/app/piper/piper', ['--model', voiceModelPath, '--output_file', 'preloaded.wav']);
    console.log(`Preloading Piper model: ${voiceModelPath}`);

    piperProcess.stdout.on('data', (data) => {
        console.log(`Piper stdout: ${data}`);
    });

    piperProcess.stderr.on('data', (data) => {
        console.error(`Piper stderr: ${data}`);
    });

    piperProcess.on('close', (code) => {
        console.log(`Piper process closed with code ${code}`);
    });
};

// Call Piper for TTS
app.post('/synthesize', (req, res) => {
    const totalStartTime = Date.now();
    const { input, voice } = req.body;

    if (!input || !voice) {
        return res.status(400).json({ error: 'Missing input text or voice model' });
    }

    const wavFilePath = path.join(__dirname, 'output.wav');
    const mp3FilePath = path.join(__dirname, 'output.mp3');
    const modelPath = path.join(__dirname, 'voices', `${voice}.onnx`);

    // If Piper process is not running, preload it
    if (!piperProcess || piperProcess.killed) {
        preloadPiperModel(modelPath);
    }

    // Start time tracking for Piper command execution
    const piperStartTime = Date.now();

    // Run Piper command
    const piperCommand = `echo "${input}" | /app/piper/piper --model ${modelPath} --output_file ${wavFilePath}`;
    
    console.log(`Executing command: ${piperCommand}`);
    
    exec(piperCommand, (error, stdout, stderr) => {
        logTime('Piper command execution', piperStartTime); // Log Piper command duration

        if (error) {
            console.error(`Error generating WAV: ${error.message}`);
            return res.status(500).json({ error: 'Failed to synthesize audio' });
        }

        // Start time tracking for ffmpeg conversion
        const ffmpegStartTime = Date.now();

        // Convert WAV to MP3 using ffmpeg
        const ffmpegCommand = `ffmpeg -i ${wavFilePath} -codec:a libmp3lame -qscale:a 2 ${mp3FilePath}`;
        
        exec(ffmpegCommand, (ffmpegError) => {
            logTime('ffmpeg conversion', ffmpegStartTime); // Log ffmpeg conversion duration

            if (ffmpegError) {
                console.error(`Error converting to MP3: ${ffmpegError.message}`);
                return res.status(500).json({ error: 'Failed to convert audio to MP3' });
            }

            // Start time tracking for sending the MP3 file back
            const sendFileStartTime = Date.now();

            // Send the MP3 file back to the client
            res.sendFile(mp3FilePath, (err) => {
                logTime('Send MP3 file to client', sendFileStartTime); // Log time to send file

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

                logTime('Total request processing', totalStartTime); // Log total time for request
            });
        });
    });
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
