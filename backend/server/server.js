require("dotenv").config();

const express = require("express");
const cors = require("cors");

const loginRoute = require("./routes/userLogin");
const getAllUsersRoute = require("./routes/userGetAllUsers");
const registerRoute = require("./routes/userSignUp");
const getUserByIdRoute = require("./routes/userGetUserById");
const dbConnection = require("./config/db.config");
const editUser = require("./routes/userEditUser");
const deleteUser = require("./routes/userDeleteAll");
const fragranceRoutes = require("./routes/fragranceRoutes");
const profileRoute = require("./routes/userProfile");

const app = express();

const SERVER_PORT = process.env.PORT || 8081;

dbConnection();

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("WaterScent backend is running.");
});

app.use("/user", loginRoute);
app.use("/user", registerRoute);
app.use("/user", getAllUsersRoute);
app.use("/user", getUserByIdRoute);
app.use("/user", editUser);
app.use("/user", deleteUser);
app.use("/user", profileRoute);
app.use("/api/fragrances", fragranceRoutes);

app.listen(SERVER_PORT, () => {
  console.log(
    `The backend service is running on port ${SERVER_PORT} and waiting for requests.`
  );
});
