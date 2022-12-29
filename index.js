const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

const user = process.env.DB_USER;
const pass = process.env.DB_PASS;
const cluster = process.env.DB_CLUSTER;


const uri = `mongodb+srv://${user}:${pass}@${cluster}/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1
});

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({ message: 'Unauthorize access' });
  }

  const token = authorization.split(' ')['1']

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' });
    }

    req.decode = decode;
    next();
  });
}

const run = async () => {
  try {
    const db = client.db('task-management');
    const tasksCollection = db.collection('tasks');

    app.post('/jwt', async (req, res) => {
      const user = req.body;

      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

      res.send({ token });
    });

    app.get('/tasks', async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const size = parseInt(req.query.size) || 10;
      const skip = (page - 1) * size;

      const query = {}
      const cursor = tasksCollection.find(query).sort({ _id: -1 });
      const tasks = await cursor.skip(skip).limit(size).toArray();

      const totalRecord = await tasksCollection.estimatedDocumentCount();
      const total = Math.ceil(totalRecord / size);

      const data = {
        data: tasks,
        pagination: {
          total,
          current: page,
        }
      }

      res.send(data);
    });

    app.get('/tasks/:id', async (req, res) => {
      const id = req.params.id;

      if (ObjectId.isValid(id)) {
        const query = { _id: ObjectId(id) }
        const task = await tasksCollection.findOne(query);

        if (task) {
          res.send(task);
        }
        else {
          res.send({ message: 'No data found..' });
        }
      }
      else {
        res.send({ message: 'No data found..' });
      }
    });

    app.get('/tasks/uid/:uid', async (req, res) => {
      const uid = req.params.uid;
      const { status } = req.query;

      const page = parseInt(req.query.page) || 1;
      const size = parseInt(req.query.size) || 10;
      const skip = (page - 1) * size;

      let query = { author: uid }

      if (status && status === 'processing') {
        query = { $and: [{ author: uid }, { status: 'processing' }] }
      }
      else if (status && status === 'completed') {
        query = { $and: [{ author: uid }, { status: 'completed' }] }
      }

      const cursor = tasksCollection.find(query).sort({ date: -1 });
      const tasks = await cursor.skip(skip).limit(size).toArray();

      const totalRecord = await tasksCollection.countDocuments(query);
      const total = Math.ceil(totalRecord / size);

      const data = {
        data: tasks,
        pagination: {
          total,
          current: page,
        }
      }

      res.send(data);
    });

    app.post('/tasks', async (req, res) => {
      const data = req.body;
      const result = await tasksCollection.insertOne(data);

      res.send(result);
    });

    app.patch('/tasks/:id', async (req, res) => {
      const id = req.params.id;
      const updateObject = req.body;

      console.log(id, updateObject);

      const query = { _id: ObjectId(id) }
      const updatedDoc = {
        $set: updateObject
      }
      const result = await tasksCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    app.delete('/tasks/:id', async (req, res) => {
      const id = req.params.id;

      const query = { _id: ObjectId(id) };
      const result = await tasksCollection.deleteOne(query);

      res.send(result);
    })
  }
  finally {

  }
}
run().catch(err => console.error(err));


app.get('/', (req, res) => {
  res.send({ message: 'Task Management Server is Running...' });
});

app.listen(port, () => {
  console.log(`The server running on ${port}`);
});