const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser'); 
const multer = require('multer'); // For handling file uploads
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3"); 
const app = express();
const port = process.env.PORT ;
const mongoURI = process.env.MONGO_URI; 
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const sesClient = new SESClient({
  region: "us-east-2", // 
  Credentials: {
    accessKeyId: "AKIA4ERMGBREBG2FS3WC",
    secretAccessKey : "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 "
  },
});
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Define a User schema and model
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  email: { type: String, unique: false },
  password: {type : String},
});

  const User = mongoose.model('User', userSchema);
  
  app.use(express.json()); 

//aws s3
const client = new S3Client({
  region :"us-east-2",
  Credentials: {
    accessKeyId: "AKIA4ERMGBREBG2FS3WC",
    secretAccessKey : "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 "
  },
});

  //route to check health of server
app.get('/health', async(req, res)=>{
    res.status(200).json({msg : "health server"})
})

// Registration route
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    // console.log(req);
    
    console.log('Password:', password); // Debugging line
  
    try {
   
      const existingUser = await User.findOne({ username });
  
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const newUser = new User({
        username,
        email,
        password: hashedPassword,
      });
  
      await newUser.save();
  
      res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
      console.error('Error during registration:', error);
      res.status(500).json({ message: 'An error occurred while registering' });
    }
  });
  
  
// Login route 
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(req.body);
  
    try {
      const user = await User.findOne({ username });
  
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
  
      const passwordMatch = await bcrypt.compare(password, user.password);
  
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
  
      const token = jwt.sign({ userId: user._id }, process.env.jwtSecretKey, { expiresIn: '1h' });
  
      res.json({ message: 'Login successful', token });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred while logging in' });
    }
  });

// Upload route
app.post('/upload', async (req, res) => {
  try {
    const { emails } = req.body;
    // console.log(req);

    // if (!Array.isArray(emails) || emails.length !== 1) {
    //   return res.status(400).json({ error: 'Invalid email list' });
    // }

    const recipientEmail = emails[0];
    const file = req.files.file;

    console.log(file);

    // Upload file to S3 bucket
    const params = {
      Bucket: 'aws-1-userfiles',
      Key: file.name,
      Body: file.data,
    };

    const uploadResult = await client.upload(params).promise();

    // Create a link to the uploaded file
    const fileUrl = uploadResult.Location;

    // Send email notification using AWS SES
    const sendEmailParams = {
      Destination: {
        ToAddresses: [recipientEmail],
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: `<p>File uploaded successfully!</p><p>Download link: <a href="${fileUrl}">${fileUrl}</a></p>`,
          },
        },
        Subject: {
          Charset: 'UTF-8',
          Data: 'File Upload Notification',
        },
      },
      Source: 'muhammadalimandela01@gmail.com', // Replace with sender email address
    };

    await sesClient.send(new SendEmailCommand(sendEmailParams));

    res.status(200).json({ message: 'File uploaded successfully', fileUrl });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'An error occurred while uploading the file' });
  }
});

  

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
