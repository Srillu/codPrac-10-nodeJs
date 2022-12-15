const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

const convertTOObject = (object) => {
  return {
    stateId: object.state_id,
    stateName: object.state_name,
    population: object.population,
  };
};

const convertDistrictToObject = (dbDistrict) => {
  return {
    districtName: dbDistrict.district_name,
    stateId: dbDistrict.state_id,
    cases: dbDistrict.cases,
    cured: dbDistrict.cured,
    active: dbDistrict.active,
    deaths: dbDistrict.deaths,
  };
};

//API 1 Login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;

  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = await jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticationToken = (request, response, next) => {
  let jwtToken;

  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 2 get all States
app.get("/states/", authenticationToken, async (request, response) => {
  const getAllStates = `
    SELECT * FROM state`;

  const statesArray = await db.all(getAllStates);
  response.send(statesArray.map((eachState) => convertTOObject(eachState)));
});

//API 3 get state by Id
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;

  const getStateId = `
    SELECT * FROM state WHERE state_id = ${stateId};`;

  const stateObject = await db.get(getStateId);
  response.send(convertTOObject(stateObject));
});

//API 4 create districtID
app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const postDistrict = `
    INSERT INTO 
          district(district_name,state_id,cases,cured,active,deaths)
    VALUES
       ('${districtName}',
       ${stateId},
       ${cases},
       ${cured},
       ${active},
       ${deaths});`;

  const districtObject = await db.run(postDistrict);
  const disId = districtObject.lastId;
  response.send("District Successfully Added");
});

//API 5 return districtId
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getDistrictObject = `
    SELECT * FROM district WHERE district_id = ${districtId};`;

    const districtRes = await db.get(getDistrictObject);
    response.send(convertDistrictToObject(districtRes));
  }
);

//API 6 delete districtId
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;

    const deleteDistrictId = `
    DELETE FROM district WHERE district_id = ${districtId};`;

    await db.run(deleteDistrictId);
    response.send("District Removed");
  }
);

//API 7 Update Details
app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;

    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const updateDistrict = `
        UPDATE 
           district 
        SET  
            district_name = "${districtName}",
            state_id = ${stateId} ,
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths}
        WHERE district_id = ${districtId};`;

    await db.run(updateDistrict);
    response.send("District Details Updated");
  }
);

//API 8 Get statistics
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;

    const getStatistics = `
      SELECT sum(cases) as totalCases,sum(cured) as totalCured,sum(active) as totalActive,sum(deaths) as totalDeaths
      FROM district WHERE state_id = ${stateId};`;

    const statisticsId = await db.get(getStatistics);
    response.send(statisticsId);
  }
);
module.exports = app;
