const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser')

require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();

// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xmhoqrm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    
    const volunteerNeedsCollection = client.db('helpNow-platform').collection('volunteerNeeds');

    // get all volunteerNeeds data from db
    app.get('/volunteerNeeds', async (req, res) => {
        const result = await volunteerNeedsCollection.find().toArray();
        res.send(result);
    })

    // get a single volunteerNeed data from db using volunteerNeed id
    app.get('/volunteerNeed/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await volunteerNeedsCollection.findOne(query);
      res.send(result);
      
    })

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', async (req, res) => {
    res.send('HelpNow-Platform server is running...')
})

app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
})