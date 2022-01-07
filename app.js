const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();

const dbPath = path.join(__dirname, "cricketTeam.db");

app.use(express.json());

app.use(cors());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    console.log(process.env.PORT);
    app.listen(process.env.PORT || 3004, () => {
      console.log("Server Running at http://localhost:3004/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const validatePassword = (password) => {
  return password.length > 4;
};

//Auth Token Validation
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "nsdfpladsnlbsd", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//Register user API 1
app.post("/register", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `
  SELECT 
    * 
  FROM 
    user 
  WHERE 
    username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    const createUserQuery = `
        INSERT INTO
            user (username, name, password, gender, location)
        VALUES
            (
            '${username}',
            '${name}',
            '${hashedPassword}',
            '${gender}',
            '${location}'  
            );`;
    // create user in user table
    if (validatePassword(password)) {
      await db.run(createUserQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    //send invalid user as response
    response.status(400);
    response.send("User already exists");
  }
});

//User Login API 2

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    //user doesn't exist
    response.status(400);
    response.send("Invalid user");
  } else {
    //compare password and hashed password.
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "nsdfpladsnlbsd");
      response.send({ jwt_token: jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Insert data into data table

app.post("/data", authenticateToken, async (request, response) => {
  const dataDetails = request.body;
  const values = dataDetails.map(
    (eachDataId) =>
      `('${eachDataId.userId}', ${eachDataId.id}, ${eachDataId.title},${eachDataId.body})`
  );

  const valuesString = values.join(",");

  const addDataQuery = `
    INSERT INTO
      data (user_id,id,title,body)
    VALUES
       ${valuesString};`;

  const dbResponse = await db.run(addDataQuery);
  response.send("uploaded successfully");
});

const convertDataObjectToResponseObject = (dataDetails) => {
  return dataDetails.map((each) => ({
    userId: each.user_id,
    id: each.id,
    title: each.title,
    body: each.body,
  }));
};

app.get("/posts", async (request, response) => {
  const selectQuery = `SELECT * FROM data;`;
  const dataDetails = await db.get(selectQuery);
  if (dataDetails !== undefined) {
    response.send(convertDataDetailsToResponseDetails(dataDetails));
  } else {
    response.send("No Posts are Posted Yet!");
  }
});

module.exports = app;
