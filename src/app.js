import { PORT } from "./utils.js";
import __dirname from "./utils.js";
import { Server } from "socket.io";
import dotenv from "dotenv";

import express from "express";
import mongoose from "mongoose";
import handlebars from "express-handlebars";
import session from "express-session";
import passport from "passport";
import { initializePassport } from "./config/passport.config.js";
import cookieParser from "cookie-parser";

import MessageModel from "./dao/mongo/models/messages.model.js";
import productsRouter from "./router/products.router.js";
import cartsRouter from "./router/carts.router.js";
import sessionRouter from "./router/session.router.js";
import viewsRouter from "./router/views.router.js";

dotenv.config();

const app = express();
app.use(express.static(`${__dirname}/public`));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const mongoURL = process.env.MONGODB_URL;
const mongoDBName = process.env.MONGODB_NAME;

app.use(cookieParser());

app.use(
  session({
    secret: process.env.SESSION_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 3600000,
    },
  })
);

initializePassport();

app.use(passport.initialize());
app.use(passport.session());

app.engine("handlebars", handlebars.engine());
app.set("views", `${__dirname}/views`);
app.set("view engine", "handlebars");

app.get("/navigation", (req, res) => {
  if (!req.cookies.jwt) return res.redirect("/login");
  res.render("navigation");
});

app.use("/", viewsRouter);
app.use("/api/products", productsRouter);
app.use("/api/carts", cartsRouter);
app.use("/api/session", sessionRouter);

mongoose
  .connect(mongoURL, { dbName: mongoDBName })
  .then(() => {
    console.log("DB connected");
    const httpServer = app.listen(PORT, () =>
      console.log(`Listening on port ${PORT}...`)
    );

    const io = new Server(httpServer);
    app.set("socketio", io);

    io.on("connection", async (socket) => {
      console.log("New client connected");

      socket.on("productList", (data) => {
        console.log("Received 'productList' from client:", data);
        io.emit("updatedProducts", data);
      });

      let messages = (await MessageModel.find().exec()) || [];

      socket.broadcast.emit("alerta");
      socket.emit("logs", messages);

      socket.on("message", async (data) => {
        messages.push(data);
        await MessageModel.create(messages);
        io.emit("logs", messages);
      });
    });
  })
  .catch((e) => console.error("Error connecting to the database:", e));
