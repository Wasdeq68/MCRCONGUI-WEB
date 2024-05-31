require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const MongoStore = require('rate-limit-mongo');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => console.log('Connected to MongoDB'));

// Define schema and model
const Schema = mongoose.Schema;
const ClickSchema = new Schema({
    ip: String,
    count: { type: Number, default: 0 },
    lastClickedAt: { type: Date, default: Date.now }
});
const Click = mongoose.model('Click', ClickSchema);

// Rate limiting middleware
const limiter = rateLimit({
    store: new MongoStore({
        uri: process.env.RATE_LIMIT_MONGODB_URI,
        expireTimeMs: 24 * 60 * 60 * 1000 // 24 hours
    }),
    max: 10, // Max requests per 24 hours
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    message: 'Rate limit exceeded'
});

app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Click endpoint
app.post('/click', limiter, async (req, res) => {
    const ip = req.ip;

    try {
        let click = await Click.findOne({ ip });

        if (!click) {
            click = new Click({ ip });
        } else if (click.lastClickedAt < Date.now() - (24 * 60 * 60 * 1000)) {
            click.count = 0; // Reset counter if last click was more than 24 hours ago
        }

        click.count++;
        click.lastClickedAt = Date.now();
        await click.save();

        res.json({ count: click.count });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
