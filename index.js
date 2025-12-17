const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 3002;

const admin = require("firebase-admin");

const serviceAccount = require("./contest-hub-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.use(cors());
app.use(express.json());

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }

  try {
    const idToken = token.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decoded_email = decoded.email;
    next();
  }
  catch (err) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
}

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@cluster0.spgu1hn.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.get('/', (req, res) => {
  res.send('ContestHub Server is running')
})

async function run() {
  try {
    await client.connect();

    // Collections
    const db = client.db("contest_hub_db");
    const usersCollection = db.collection("users");
    const contestsCollection = db.collection("contests");

    const verifyAdmin = async (req, res, next) => {

      const email = req.decoded_email;
      const query = { email };
      const user = await usersCollection.findOne(query);

      if (!user || user.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden Access' });
      }

      next();
    }

    // Users Related APIs
    app.get("/users", verifyFBToken, async (req, res) => {
      const cursor = usersCollection.find().sort({ createdAt: -1 });
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get("/users/:id", async (req, res) => {

    })

    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ role: user?.role || "user" })
    })

    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "user";
      user.createdAt = new Date();
      const email = user.email;

      const userExists = await usersCollection.findOne({ email });

      if (userExists) {
        return res.send({ message: 'user exists' });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    app.patch('/users/:id/role', verifyFBToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const roleInfo = req.body;
      const query = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: roleInfo.role
        }
      }
      const result = await usersCollection.updateOne(query, updatedDoc);
      res.send(result);
    })

    // Contests related APIs
    app.get('/popular-contests', async (req, res) => {
      const query = { approval_status: "approved" };
      const cursor = contestsCollection.find(query).sort({ participants_count: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/all-contests', async (req, res) => {
      const query = { approval_status: "approved" };
      const cursor = contestsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/manage-contests', async (req, res) => {
      const cursor = contestsCollection.find().sort({ createdAt: -1 });
      const result = await cursor.toArray();
      res.send(result);
    })

    app.patch('/manage-contests/:id/approval_status', verifyFBToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const approval_status = req.body;
      const query = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          approval_status: approval_status.approval_status
        }
      }
      const result = await contestsCollection.updateOne(query, updatedDoc);
      res.send(result);
    })

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (err) {
    console.error(err);
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})