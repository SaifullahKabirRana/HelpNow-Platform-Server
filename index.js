const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')

require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174', 'https://helpnow-platform.vercel.app', 'https://helpnow-platform.web.app'],
  credentials: true,
  optionSuccessStatus: 200,
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());


// verify jwt middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  console.log('value of the token in middleware:', token);
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized' })
  }
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).send({ message: 'Unauthorized' });
      }
      console.log('decoded', decoded);
      req.user = decoded;
      next();
    })
  }

}

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
    const volunteerRequestsCollection = client.db('helpNow-platform').collection('volunteerRequests');

    // jwt generate
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      console.log(user);;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '30d'
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
        })
        .send({ success: true })
    })

    // clear token on logout
    app.post('/logout', async (req, res) => {
      const user = req.body;
      res
        .clearCookie('token', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          maxAge: 0
        })
        .send({ success: true });
    })

    // get all volunteerNeeds data from db
    app.get('/volunteerNeeds', async (req, res) => {
      const result = await volunteerNeedsCollection.find().sort({ deadline: 1 }).toArray();
      res.send(result);
    })

    // get a single volunteerNeed data from db using volunteerNeed id
    app.get('/volunteerNeed/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await volunteerNeedsCollection.findOne(query);
      res.send(result);
    })

    // save a volunteer need data in db
    app.post('/volunteerNeed', async (req, res) => {
      const volunteerData = req.body;
      const result = await volunteerNeedsCollection.insertOne(volunteerData);
      res.send(result);
    })

    // get all volunteerNeed posted by specific user (manage may post)
    app.get('/volunteerNeeds/:email', verifyToken, async (req, res) => {
      const tokenEmail = req.user?.email;
      const email = req.params.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: 'Forbidden access' })
      }
      console.log(' valid token email', email);
      const query = { 'organizer.email': email };
      const result = await volunteerNeedsCollection.find(query).toArray();
      res.send(result);
    })

    // update a volunteerNeed data in db (manage my post)
    app.put('/volunteerNeed/:id', async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...updateData
        }
      }
      const result = await volunteerNeedsCollection.updateOne(query, updateDoc, options);
      res.send(result);
    })

    // delete a volunteerNeed data from db (manage my post)
    app.delete('/volunteerNeed/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await volunteerNeedsCollection.deleteOne(query);
      res.send(result);
    })

    // save a volunteerRequest data in db (be a volunteer)
    app.post('/volunteerRequest', async (req, res) => {
      const volunteerData = req.body;
      const result = await volunteerRequestsCollection.insertOne(volunteerData);

      // Update volunteersNeeded count in volunteerNeedsCollection
      const updateDoc = {
        $inc: { volunteersNeeded: -1 }
      }
      const volunteerQuery = { _id: new ObjectId(volunteerData?.volunteerId) };
      const updateVolunteersNeeded = await volunteerNeedsCollection.updateOne(volunteerQuery, updateDoc);
      // console.log('update count:', updateVolunteersNeeded);
      res.send(result)
    })

    // get all volunteer request for a user by email from db (manage my post)
    app.get('/my-request/:email', verifyToken, async (req, res) => {
      const tokenEmail = req.user?.email;
      const email = req.params.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: 'Forbidden access' })
      }
      const query = { 'volunteer.email': email };
      const result = await volunteerRequestsCollection.find(query).toArray();
      res.send(result);
    });

    // delete a volunteer request data from db (manage my post)
    app.delete('/volunteerRequest/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      // Find the volunteer request before deleting
      const volunteerRequest = await volunteerRequestsCollection.findOne(query);
      // delete the request
      const result = await volunteerRequestsCollection.deleteOne(query);

      // Update volunteersNeeded
      const volunteerQuery = { _id: new ObjectId(volunteerRequest?.volunteerId) }
      const updateDoc = {
        $inc: { volunteersNeeded: + 1 }
      }
      const updateVolunteersNeeded = await volunteerNeedsCollection.updateOne(volunteerQuery, updateDoc);
      res.send(result);
    })

    // search volunteer need posts
    app.get('/searchPosts', async (req, res) => {
      const search = req.query.search;
      const query = {
        postTitle: { $regex: search, $options: 'i' }
      }
      const result = await volunteerNeedsCollection.find(query).toArray();
      res.send(result);

    })

    // get all volunteer requests for organizer (volunteer requests)
    app.get('/volunteer-requests/:email', verifyToken, async (req, res) => {
      const tokenEmail = req.user?.email;
      const email = req.params.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: 'Forbidden access' })
      }
      const query = { 'organizer.email': email };
      const result = await volunteerRequestsCollection.find(query).toArray();
      res.send(result);
    })

    // update status 
    app.patch('/volunteer-requests/:id', async (req, res) => {
      const id = req.params.id;
      const status = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: status,
      }
      const result = await volunteerRequestsCollection.updateOne(query, updateDoc);
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