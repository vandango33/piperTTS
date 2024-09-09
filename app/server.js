const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const port = 3000;

// Set up multer for file upload handling
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint to handle TTS requests
app.post('/generate-audio', upload.single('file'), (req, res) => {
  const text = req.body.text;
  const voice = req.body.voice; // Not used directly in this example
  const modelPath = path.join(__dirname, 'path/to/your/model'); // Path to your model

  if (!text) {
    return res.status(400).send('Text is required.');
  }

  // Command to run Piper (adjust according to your setup)
  const command = `./piper --model ${modelPath} --output_file /tmp/output.wav "${text}"`;

  exec(command, (error) => {
    if (error) {
      return res.status(500).send('Error generating audio.');
    }

    // Send the audio file as response
    res.sendFile('/tmp/output.wav');
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
